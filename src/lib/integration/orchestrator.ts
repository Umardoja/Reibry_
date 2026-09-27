import { createClient } from "@/lib/supabase/server";
import { captureIdentity } from "@/lib/auth/capture-identity";
import { createStore } from "@/lib/data/supabase-store";
import { IntegrationError } from "./errors";
import { deriveCategory, deriveTags, enrichCapture, evidenceText, normalizeCategory } from "@/lib/sources/enrichment";
import { normalizeCaptureBase, type CaptureRequest } from "@/lib/sources/adapters";
import { sourcePreservation, analyzeOrPreserve } from "../capture/source-preservation";
import { activeAI } from "./mock";
import { resolveLifeDateRange } from "./relative-date";
import { deterministicLifeFallback } from "./life-fallback";
import type { SearchRequest, MatchRequest, ActionRequest, FeedbackRequest } from "@/lib/api/contracts";
import { retrievalService } from "@/lib/retrieval/service";
import { normalizedTerms, normalizeVisualSearchQuery, parseRetrievalHints } from "@/lib/retrieval/understanding";
import { actionService } from "@/lib/actions/service";
import { meaningfulAction } from "@/lib/actions/policy";
import type { ActionType, JsonValue, LifeContext, Memory, SuggestedAction } from "@/types/reibry";
import type { Store } from "@/lib/data/store";
import type { AIService } from "@/lib/ai/service";
import { rankResurfacedMemories } from "./today-ranking";
import { prepareCaptureSource, sourceAnalysisStatus } from "../sources/prepare-capture";
import { enrichAnalysisMetadata } from "../intelligence/evidence";
import { partitionLifeContexts, isDuplicateLifeContext } from "@/lib/life/management";
import { fetchThumbnail } from "@/lib/intelligence/thumbnail";
import { mergeThumbnailEvidence } from "@/lib/intelligence/visual-evidence";
import { memoryEmbeddingText } from "@/lib/intelligence/embedding-text";

const supportedActionTypes = new Set(["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"]);
const relevanceStopWords = new Set(["a", "an", "and", "are", "for", "in", "is", "it", "of", "on", "or", "the", "this", "to", "was"]);

function captureUrlDiagnostic(stage: string, input: { sourceUrl?: string; sourceType?: string }, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "production" && input.sourceUrl) console.info("[capture-url]", { stage, sourceType: input.sourceType, hasUrl: true, ...details });
}

export function validateVectorEmbedding(embedding: unknown, label: string): number[] {
  if (!Array.isArray(embedding) || embedding.length !== 2048 || !embedding.every((value) => Number.isFinite(value))) {
    throw new IntegrationError("AI_UNAVAILABLE", `NVIDIA ${label} is invalid.`);
  }
  return embedding as number[];
}

export function captureFailureMetadata(evidence: Parameters<AIService["analyze"]>[0]["evidence"]) {
  return {
    status: "failed" as const,
    confidence: null,
    provider: process.env.AI_PROVIDER || "unknown",
    warnings: ["Memory analysis could not be completed."],
    evidenceSources: evidence,
  };
}

function lexicalSimilarity(left: { title: string; description?: string | null }, right: { title: string; summary?: string | null; category?: string | null; tags?: string[]; entities?: Array<string | { name?: string }>; possibleIntents?: string[]; sourcePlatform?: string | null }): number {
  const terms = new Set(`${left.title} ${left.description || ""}`.toLowerCase().split(/\W+/).filter((term) => term && !relevanceStopWords.has(term)));
  const hay = `${right.title} ${right.summary || ""} ${right.category || ""} ${(right.tags || []).join(" ")} ${(right.entities || []).map((entity) => typeof entity === "string" ? entity : entity.name || "").join(" ")} ${(right.possibleIntents || []).join(" ")} ${right.sourcePlatform || ""}`.toLowerCase();
  const hits = [...terms].filter((term) => hay.includes(term)).length;
  return terms.size ? hits / terms.size : 0;
}

function lifeEmbeddingText(context: LifeContext) {
  return [context.type, context.title, context.description, context.startDate, context.endDate].filter(Boolean).join("\n");
}


export async function runNvidiaMemorySearch({
  store,
  userId,
  query,
  limit,
  embed,
}: {
  store: Store;
  userId: string;
  query: string;
  limit: number;
  embed: (text: string) => Promise<number[]>;
}) {
  if (process.env.NODE_ENV !== "production") console.info("[nvidia:query-embedding] provider-selected", { limit, inputLength: query.length });

  const embedding = validateVectorEmbedding(await embed(query), "query-embedding");
  const vectorMatches = await store.vectorSearch(embedding, 0, limit);
  const byId = new Map(vectorMatches.map((match) => [match.id, match.similarity]));
  const candidates = (await store.list("memories")).filter((memory) => memory.userId === userId && memory.analysisStatus !== "failed");

  return candidates
    .filter((memory) => byId.has(memory.id))
    .map((memory) => ({
      memory,
      similarity: byId.get(memory.id) ?? 0,
      reason: `Vector match confidence ${byId.get(memory.id) ?? 0}.`,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export async function runNvidiaContextRelevance({
  store,
  life,
  candidates,
  evaluateRelevance,
}: {
  store: Store;
  life: LifeContext;
  candidates: Memory[];
  evaluateRelevance: (
    memory: Memory,
    lifeContext: LifeContext,
    similarity: number,
  ) => Promise<{ relevant: boolean; confidence: number; reason: string; suggestedAction?: SuggestedAction | null }>;
}) {
  if (process.env.NODE_ENV !== "production") console.info("[nvidia:context-relevance] provider-selected", { lifeContextId: life.id, candidateCount: candidates.length });

  const matchInputs: Parameters<Store["saveMatch"]>[0][] = [];
  const existingMatches = await store.list("memory_context_matches");
  const existingByPair = new Map(existingMatches.map((match) => [`${match.memoryId}:${match.lifeContextId}`, match]));

  for (const memory of candidates) {
    const similarity = lexicalSimilarity(life, memory);
    if (similarity <= 0) continue;

    const relevance = await evaluateRelevance(memory, life, similarity);
    if (!relevance.relevant || relevance.confidence < 0.25 || !String(relevance.reason || "").trim()) continue;

    const existing = existingByPair.get(`${memory.id}:${life.id}`);
    if (existing?.status === "dismissed") continue;

    matchInputs.push({
      memoryId: memory.id,
      lifeContextId: life.id,
      similarity: relevance.confidence,
      confidence: relevance.confidence,
      reason: relevance.reason,
      suggestedAction: relevance.suggestedAction ?? null,
      status: existing?.status || "pending",
    });
  }

  return Promise.all(matchInputs.map((input) => store.saveMatch(input)));
}

export async function runNvidiaActionGeneration({
  store,
  input,
  generateAction,
}: {
  store: Store;
  input: ActionRequest;
  generateAction: (
    type: string,
    memory: Memory | null,
    life: LifeContext | null,
  ) => Promise<{ type: string; title: string; description?: string; payload: Record<string, unknown> }>;
}) {
  if (process.env.NODE_ENV !== "production") console.info("[nvidia:action-generation] provider-selected", { type: input.type, memoryId: input.memoryId || null, lifeContextId: input.lifeContextId || null, matchId: input.matchId || null });

  const memory = input.memoryId ? await store.get("memories", input.memoryId) : null;
  const life = input.lifeContextId ? await store.get("life_contexts", input.lifeContextId) : null;
  const action = await generateAction(input.type, memory, life);

  if (!supportedActionTypes.has(action.type)) {
    throw new IntegrationError("AI_UNAVAILABLE", "NVIDIA action type is unsupported.");
  }

  return store.insert("actions", {
    type: action.type as ActionType,
    title: action.title,
    description: action.description,
    payload: (action.payload ?? {}) as Record<string, JsonValue>,
    memoryId: memory?.id || null,
    lifeContextId: life?.id || null,
    matchId: input.matchId || null,
    status: "suggested",
  });
}

export async function verifiedStore() {
  const c = await createClient();
  const { data, error } = await c.auth.getClaims();
  if (error || !data?.claims.sub) throw new IntegrationError("AUTH_REQUIRED", "Sign in to use this endpoint.");
  return { client: c, store: createStore(c, data.claims.sub), userId: data.claims.sub };
}

export async function capture(input: CaptureRequest) {
  const identity = await captureIdentity();
  const store = createStore(identity.client, identity.userId);
  // An explicit recapture can recover an old failed save without creating another row.
  async function existingCapture(memory: Memory) {
    if (memory.analysisStatus !== "failed") return { memory, duplicate: true };
    const source = await enrichCapture({ sourceType: memory.sourceType, sourceUrl: memory.sourceUrl || undefined,
      rawText: memory.rawText || undefined, evidence: memory.evidenceSources });
    const preserved = sourcePreservation(source);
    const saved = await store.update("memories", memory.id, { ...preserved.memory, category: normalizeCategory(preserved.memory.category), analysisStatus: "partial", confidence: null,
      evidenceSources: source.evidence, analysisMetadata: preserved.metadata });
    return { memory: saved, metadata: preserved.metadata, duplicate: true };
  }
  captureUrlDiagnostic("detect", input);
  const normalized = await normalizeCaptureBase(input);
  captureUrlDiagnostic("normalize", normalized);
  captureUrlDiagnostic("dedupe", normalized);
  const prepared = await prepareCaptureSource(normalized, (key) => store.findMemoryByDedupeKey(key));
  if (prepared.existing) return existingCapture(prepared.existing);
  const dedupeKey = prepared.dedupeKey;
  captureUrlDiagnostic("source", normalized);
  const n = await enrichCapture(prepared.normalized);
  captureUrlDiagnostic("enrich", n, { evidenceCount: n.evidence.length, enriched: n.evidence.some((item) => Boolean(item.title || item.caption || item.author)) });

  const preserved = sourcePreservation(n);
  const inserted = await store.insertMemory({
    ...preserved.memory,
    title: preserved.memory.title!,
    summary: preserved.memory.summary || null,
    category: "Other",
    tags: [],
    entities: [],
    sourceUrl: n.sourceUrl || null,
    sourcePlatform: n.evidence[0]?.platform || null,
    sourceType: n.sourceType,
    rawText: n.rawText || null,
    possibleIntents: [],
    possibleActions: [],
    analysisStatus: "partial",
    confidence: null,
    evidenceSources: n.evidence,
    analysisMetadata: preserved.metadata,
    dedupeKey,
  });
  if (inserted.duplicate) return existingCapture(inserted.memory);
  const m = inserted.memory;

  const ai = activeAI();
  if (!ai) throw new IntegrationError("AI_UNAVAILABLE", "AI provider is unavailable.");
  let visual: Awaited<ReturnType<NonNullable<AIService["analyzeThumbnail"]>>> = null;
  const thumbnail = n.evidence.find((item) => item.thumbnail)?.thumbnail;
  if (thumbnail && ai.analyzeThumbnail) {
    const image = await fetchThumbnail(thumbnail);
    if (image) {
      try { visual = await ai.analyzeThumbnail({ image, title: n.title, caption: n.rawText, platform: n.evidence[0]?.platform }); }
      catch (error) { if (process.env.NODE_ENV !== "production") console.warn("[thumbnail] analysis unavailable", { errorType: error instanceof Error ? error.name : "UnknownError" }); }
    }
  }
  const analysis = await analyzeOrPreserve(n, () => ai.analyze({ memory: m, evidence: n.evidence }));
  const result = analysis.result;
  const sourceText = evidenceText(n.evidence, n.rawText, n.title || m.title);
  const evidenceLower = sourceText.toLowerCase();
  const safeTags = analysis.preserved ? result.memory.tags || [] : [...new Set([
    ...deriveTags(sourceText),
    ...(result.memory.tags || []).filter((tag) => evidenceLower.includes(tag.toLowerCase())),
  ])].slice(0, 8);
  const finalStatus = sourceAnalysisStatus(n, result.metadata.status);
  const baseMetadata = finalStatus === result.metadata.status ? result.metadata : { ...result.metadata, status: finalStatus, warnings: [...result.metadata.warnings, "The URL could not be enriched; saved with limited understanding."] };
  captureUrlDiagnostic("finalize", n, { analysisStatus: finalStatus });
  const providerCategory = normalizeCategory(result.memory.category);
  const evidenceCategory = deriveCategory(sourceText);
  const category = providerCategory === "Other" || (evidenceCategory === "Food & Cooking" && providerCategory !== "Food & Cooking") ? evidenceCategory : providerCategory;
  const understood = { ...m, ...result.memory, category, tags: safeTags, analysisStatus: finalStatus, confidence: baseMetadata.confidence, evidenceSources: baseMetadata.evidenceSources, analysisMetadata: baseMetadata } as Memory;
  const finalMetadata = enrichAnalysisMetadata(understood, baseMetadata);
  if (visual) {
    Object.assign(finalMetadata, mergeThumbnailEvidence(finalMetadata, visual));
  }
  const merged = { ...understood, category: normalizeCategory(understood.category), analysisMetadata: finalMetadata };
  let saved = await store.update("memories", m.id, merged);
  let metadata = finalMetadata;
  try {
    const embedding = validateVectorEmbedding(await ai.embed(memoryEmbeddingText(saved)), "memory-embedding");
    await store.setEmbedding(saved.id, embedding);
  } catch (error) {
    metadata = { ...metadata, status: metadata.status === "failed" ? "failed" : "partial", warnings: [...metadata.warnings, "Semantic indexing was unavailable; the Memory was saved without an embedding."] };
    saved = await store.update("memories", saved.id, { analysisStatus: metadata.status, analysisMetadata: metadata });
    if (process.env.NODE_ENV !== "production") console.warn("[memory] embedding unavailable; saved partial Memory", { errorType: error instanceof Error ? error.name : "UnknownError" });
  }
  return { memory: saved, metadata, duplicate: false };
}

export async function parseAndSaveLife(input: { text: string; timezone: string }) {
  const { store } = await verifiedStore();
  const ai = activeAI();
  if (!ai) throw new IntegrationError("AI_UNAVAILABLE", "AI provider is unavailable.");
  const referenceNow = new Date();
  let result: Awaited<ReturnType<AIService["parseLife"]>>;
  try {
    result = await ai.parseLife(input);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("[life] provider parsing unavailable; preserving deterministic context", { errorType: error instanceof Error ? error.name : "UnknownError" });
    result = deterministicLifeFallback({ ...input, referenceNow });
  }
  const normalizedContexts = result.contexts.map((context) => {
    const dates = resolveLifeDateRange({ startValue: context.startDate || input.text, endValue: context.endDate, referenceNow, timeZone: input.timezone });
    return { ...context, startDate: dates.startDate, endDate: dates.endDate };
  });
    const existingContexts = await store.list("life_contexts");
    const freshContexts = normalizedContexts.filter((candidate) => !existingContexts.some((existing) => isDuplicateLifeContext(existing, candidate)));
    const contexts = freshContexts.length ? await store.insertLife(freshContexts) : existingContexts.filter((existing) => normalizedContexts.some((candidate) => isDuplicateLifeContext(existing, candidate)));
  let metadata = result.metadata;
  for (const context of contexts) {
    try {
      const embedding = validateVectorEmbedding(await ai.embed(lifeEmbeddingText(context)), "life-embedding");
      await store.setLifeEmbedding(context.id, embedding);
    } catch (error) {
      metadata = { ...metadata, warnings: [...metadata.warnings, "Semantic indexing was unavailable; the Life context was saved without an embedding."] };
      if (process.env.NODE_ENV !== "production") console.warn("[life] embedding unavailable; saved Life context without vector", { errorType: error instanceof Error ? error.name : "UnknownError" });
    }
  }
  return { contexts, metadata };
}

export async function today() {
  const { store } = await verifiedStore();
  const [contexts, matches, actions] = await Promise.all([store.listForToday("life_contexts"), store.listForToday("memory_context_matches"), store.listForToday("actions")]);
  const memories = await store.getMemories([...new Set(matches.map((match) => match.memoryId))]);

    const upcomingLifeContexts = partitionLifeContexts(contexts, new Date()).upcoming.slice(0, 3);
  const resurfacedMemories = rankResurfacedMemories(matches, contexts, memories);
  const suggestedActions = actions.filter((action) => action.status === "suggested").map((action) => ({ type: action.type, title: action.title, description: action.description || undefined, payload: action.payload }));
  const uniqueSuggestedActions = suggestedActions.filter((action, index, all) => all.findIndex((candidate) => candidate.type === action.type && candidate.title === action.title) === index).slice(0, 3);

  return {
    upcomingLifeContexts,
    resurfacedMemories,
    reminders: upcomingLifeContexts.filter((context) => context.type === "reminder"),
    suggestedActions: uniqueSuggestedActions,
  };
}

export async function feedback(input: FeedbackRequest) {
  const { store } = await verifiedStore();
  const match = await store.get("memory_context_matches", input.matchId);
  const status = input.feedback === "dismissed" ? "dismissed" : input.feedback === "useful" ? "accepted" : "pending";

  await store.update("memory_context_matches", match.id, { status });
  await store.insert("feedback", {
    memoryId: null,
    matchId: match.id,
    actionId: null,
    type: input.feedback === "dismissed" ? "dismissed" : input.feedback === "useful" ? "useful" : "not_useful",
    comment: null,
  });

  return { matchId: match.id, status };
}

export async function searchMemories(input: SearchRequest, userId: string) {
  const { store } = await verifiedStore();
  const ai = activeAI();
  const hints = parseRetrievalHints(input.query);
  const searchQuery = normalizeVisualSearchQuery(input.query);
  const expandedSearch = [...normalizedTerms(searchQuery)].slice(0, 12).join(" ");
  const started = Date.now();
  const lexicalStarted = Date.now();
  const lexicalPromise = store.listMemories({ limit: 50, search: expandedSearch || input.query, ...hints }).then((value) => ({ value, durationMs: Date.now() - lexicalStarted }));
  const vectorStarted = Date.now();
  const vectorPromise = (async () => {
    const embedding = validateVectorEmbedding(await ai.embed(searchQuery), "query-embedding");
    const vectorMatches = await store.vectorSearch(embedding, 0, 40);
    const memories = await store.getMemories(vectorMatches.map((match) => match.id));
    return { memories, similarities: new Map(vectorMatches.map((match) => [match.id, match.similarity])), durationMs: Date.now() - vectorStarted };
  })();
  const [lexicalResult, vectorResult] = await Promise.allSettled([lexicalPromise, vectorPromise]);
  const lexicalPage = lexicalResult.status === "fulfilled" ? lexicalResult.value.value : { items: [], nextCursor: null };
  const vector = vectorResult.status === "fulfilled" ? vectorResult.value : { memories: [], similarities: new Map<string, number>(), durationMs: 0 };
  if (process.env.NODE_ENV !== "production") {
    if (lexicalResult.status === "rejected") console.warn("[ask] lexical candidates unavailable", { errorType: lexicalResult.reason instanceof Error ? lexicalResult.reason.name : "UnknownError" });
    if (vectorResult.status === "rejected") console.warn("[ask] vector candidates unavailable; using lexical candidates", { errorType: vectorResult.reason instanceof Error ? vectorResult.reason.name : "UnknownError" });
    console.info("[ask] timings", { totalMs: Date.now() - started, lexicalMs: lexicalResult.status === "fulfilled" ? lexicalResult.value.durationMs : null, vectorMs: vectorResult.status === "fulfilled" ? vectorResult.value.durationMs : null, lexicalCandidates: lexicalPage.items.length, vectorCandidates: vector.memories.length });
  }
  const byId = new Map(lexicalPage.items.map((memory) => [memory.id, memory]));
  for (const memory of vector.memories) byId.set(memory.id, memory);
  return retrievalService.searchMemories({ userId, query: input.query, limit: input.limit, memories: [...byId.values()], vectorSimilarities: vector.similarities });
}

/** Owner-scoped, single-Memory preview re-analysis. It updates evidence only, never Memory content. */
export async function reanalyzeMemoryPreview(memoryId: string) {
  if (process.env.AI_PROVIDER !== "gemini") throw new IntegrationError("AI_UNAVAILABLE", "Preview re-analysis requires the configured Gemini provider.");
  const { store } = await verifiedStore();
  const memory = await store.get("memories", memoryId);
  let evidenceSources = memory.evidenceSources;
  let previewUrl = evidenceSources.find((item) => item.thumbnail)?.thumbnail;
  let rejectionReason = previewUrl ? "unknown" : "no-saved-thumbnail";
  let image = previewUrl ? await fetchThumbnail(previewUrl, (reason) => { rejectionReason = reason; }) : null;
  // Signed platform thumbnail URLs may expire. Refresh only from the Memory's
  // existing public source using the same bounded oEmbed/page enrichment path.
  if (!image && memory.sourceUrl) {
    const refreshed = await enrichCapture({ sourceType: memory.sourceType, sourceUrl: memory.sourceUrl, rawText: memory.rawText || undefined, title: memory.title, evidence: memory.evidenceSources });
    evidenceSources = refreshed.evidence;
    previewUrl = evidenceSources.find((item) => item.thumbnail)?.thumbnail;
    rejectionReason = previewUrl ? "unknown" : "source-had-no-thumbnail";
    image = previewUrl ? await fetchThumbnail(previewUrl, (reason) => { rejectionReason = reason; }) : null;
  }
  if (!image) throw new IntegrationError("VALIDATION_ERROR", `The saved source preview could not be safely accessed.${process.env.NODE_ENV !== "production" ? ` (${rejectionReason})` : ""}`);
  const ai = activeAI({ allowFallback: false });
  const result = await ai.analyzeThumbnail?.({ image, title: memory.title, caption: evidenceSources.find((item) => item.caption)?.caption || memory.rawText || undefined, description: memory.summary || undefined, platform: memory.sourcePlatform || undefined });
  if (!result) throw new IntegrationError("AI_UNAVAILABLE", "The source preview could not be analyzed.");
  const metadata = mergeThumbnailEvidence(memory.analysisMetadata || { status: memory.analysisStatus, confidence: memory.confidence, warnings: [], evidenceSources }, result);
  metadata.evidenceSources = evidenceSources;
  const updated = await store.update("memories", memory.id, { analysisMetadata: metadata, evidenceSources });
  try { await store.setEmbedding(updated.id, validateVectorEmbedding(await ai.embed(memoryEmbeddingText(updated)), "memory-embedding")); }
  catch (error) { if (process.env.NODE_ENV !== "production") console.warn("[thumbnail] visual index refresh unavailable", { errorType: error instanceof Error ? error.name : "UnknownError" }); }
  return updated;
}

export async function matchContext(input: MatchRequest) {
  const { store } = await verifiedStore();
  const ai = activeAI();
  const life = await store.get("life_contexts", input.lifeContextId);
  const lifeQuery = `${life.title} ${life.description || ""}`;
  const candidatePage = await store.listMemories({ limit: 50, search: [...normalizedTerms(lifeQuery)].slice(0, 12).join(" ") });
  const memories = candidatePage.items;
  const candidates = memories.filter(
    (memory) => (!input.memoryIds || input.memoryIds.includes(memory.id)) && memory.analysisStatus !== "failed" && memory.userId === store.userId,
  );

  if (process.env.AI_PROVIDER !== "nvidia") {
    const resultInputs: Parameters<Store["saveMatch"]>[0][] = [];
    const existingMatches = await store.list("memory_context_matches");
    const existingByPair = new Map(existingMatches.map((match) => [`${match.memoryId}:${match.lifeContextId}`, match]));
    const rankedCandidates = candidates
      .map((memory) => ({ memory, similarity: lexicalSimilarity(life, memory) }))
      .filter((candidate) => candidate.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map((candidate) => candidate.memory);
    for (const memory of rankedCandidates) {
      const confidence = lexicalSimilarity(life, memory);
      if (confidence < 0.25) continue;

      const existing = existingByPair.get(`${memory.id}:${life.id}`);
      if (existing?.status === "dismissed") continue;

      resultInputs.push({
        memoryId: memory.id,
        lifeContextId: life.id,
        similarity: confidence,
        confidence,
        reason: `You saved “${memory.title}”, which relates to “${life.title}”.`,
        suggestedAction: null,
        status: existing?.status || "pending",
      });
    }
    return Promise.all(resultInputs.map((input) => store.saveMatch(input)));
  }

  const rankedCandidates = candidates
    .map((memory) => ({ memory, similarity: lexicalSimilarity(life, memory) }))
    .filter((candidate) => candidate.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((candidate) => candidate.memory);

  return runNvidiaContextRelevance({
    store,
    life,
    candidates: rankedCandidates,
    evaluateRelevance: async (memory, lifeContext, similarity) => {
      if (!ai.evaluateRelevance) {
        return { relevant: true, confidence: 0.75, reason: "Candidate review passed semantic relevance gate." };
      }
      const result = await ai.evaluateRelevance(memory, lifeContext, similarity);
      return { ...result, suggestedAction: result.suggestedAction as SuggestedAction | null | undefined };
    },
  });
}

export async function generateAction(input: ActionRequest, userId: string) {
  const { store } = await verifiedStore();
  const ai = activeAI();

  let memoryId = input.memoryId;
  let lifeContextId = input.lifeContextId;

  if (input.matchId) {
    const match = await store.get("memory_context_matches", input.matchId);
    memoryId = match.memoryId;
    lifeContextId = match.lifeContextId;
  }

  const memory = memoryId ? await store.get("memories", memoryId) : null;
  const life = lifeContextId ? await store.get("life_contexts", lifeContextId) : null;

  if (process.env.AI_PROVIDER !== "nvidia") {
    const grounded = memory && life ? meaningfulAction(memory, life, input.type) : null;
    const action = grounded ? { type: grounded.type, title: grounded.title, description: grounded.description, payload: grounded.payload } : await actionService.generate({ ...input, userId });
    return store.insert("actions", { ...action, memoryId: memoryId || null, lifeContextId: lifeContextId || null, matchId: input.matchId || null, status: "suggested" });
  }

  return runNvidiaActionGeneration({
    store,
    input,
    generateAction: async (type, memory, life) => {
      if (!ai.generateAction) {
        return { type, title: "Generated action", description: "NVIDIA action generation unavailable.", payload: {} };
      }
      return ai.generateAction(type, memory, life);
    },
  });
}
