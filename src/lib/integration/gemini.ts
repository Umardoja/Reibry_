import type { AIService } from "../ai/service.ts";
import type { ActionType, LifeContext, Memory } from "../../types/reibry.ts";
import { deriveCategory, deriveTags, evidenceText, normalizeCategory } from "../sources/enrichment.ts";
import { IntegrationError } from "./errors.ts";
import { z } from "zod";

const supportedActions = ["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"] as const;
const lifeTypes = ["event", "goal", "deadline", "trip", "task", "project", "interest", "reminder"] as const;
const categories = ["Education & Learning", "Technology", "Food & Cooking", "Finance", "Travel", "Health & Fitness", "Work & Career", "Entertainment", "Shopping", "Personal", "Ideas & Inspiration", "Other"] as const;
const memoryOutput = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().max(20000).nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  entities: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
  possibleIntents: z.array(z.string()).optional(),
  possibleActions: z.array(z.object({ type: z.enum(supportedActions), title: z.string(), description: z.string().optional(), payload: z.record(z.string(), z.json()) })).optional(),
  confidence: z.union([z.number().finite().min(0).max(1), z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/).transform(Number)]).nullable().optional(),
});
const lifeOutput = z.object({ type: z.enum(lifeTypes), title: z.string().trim().min(1).max(300), description: z.string().max(20000).optional(), startDate: z.string().nullable().optional(), endDate: z.string().nullable().optional(), confidence: z.union([z.number().finite().min(0).max(1), z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/).transform(Number)]).nullable().optional() });
const actionOutput = z.object({ type: z.enum(supportedActions).optional(), title: z.string().trim().min(1).max(300), description: z.string().optional(), payload: z.record(z.string(), z.json()).default({}) });
const relevanceOutput = z.object({ relevant: z.boolean(), confidence: z.union([z.number().finite().min(0).max(1), z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/).transform(Number)]), reason: z.string().trim().min(1), suggestedAction: z.union([z.enum(supportedActions), z.null()]).optional() });
const thumbnailOutput = z.object({ description: z.string().max(1000), primaryObjects: z.array(z.string().max(80)).max(8), visualConcepts: z.array(z.string().max(80)).max(16), attributes: z.array(z.string().max(80)).max(12), relationships: z.array(z.string().max(120)).max(12), activities: z.array(z.string().max(80)).max(8), visibleText: z.array(z.string().max(120)).max(8), confidence: z.enum(["high", "medium", "low"]) });
const homeInterpretation = z.object({ intent: z.enum(["SEARCH_MEMORY", "CREATE_INTENTION", "UPDATE_INTENTION", "SHOW_UPCOMING", "BUILD_READY_PACK", "UPDATE_READY_PACK", "MEMORY_SELECTION", "PACK_SELECTION", "SHOW_MORE", "CLARIFICATION", "SCOPED_CONVERSATION", "OUT_OF_SCOPE"]), tool: z.enum(["searchMemories", "listUpcomingPlans", "none"]), searchQuery: z.string().max(200), requiredConcepts: z.array(z.string().max(80)).max(8), needsClarification: z.boolean(), reply: z.string().max(300) });
const thumbnailVerification = z.object({ matches: z.boolean(), subject: z.string().max(40), requestedAttribute: z.string().max(80), evidence: z.string().max(300), confidence: z.enum(["high", "medium", "low"]) });

// Gemini's responseSchema is deliberately kept to the small subset supported
// by the hosted generateContent endpoint. These schemas constrain the wire
// response; the Zod schemas above remain the application authority.
const memoryResponseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    category: { type: "STRING", enum: categories },
    confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    entities: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, type: { type: "STRING" } }, required: ["name", "type"] } },
    possibleIntents: { type: "ARRAY", items: { type: "STRING" } },
    possibleActions: { type: "ARRAY", items: { type: "OBJECT", properties: { type: { type: "STRING", enum: supportedActions }, title: { type: "STRING" }, description: { type: "STRING" }, payload: { type: "OBJECT" } }, required: ["type", "title", "payload"] } },
  },
  required: ["title", "summary", "category", "confidence", "tags", "entities", "possibleIntents", "possibleActions"],
} as const;
const lifeResponseSchema = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: lifeTypes },
    title: { type: "STRING" },
    description: { type: "STRING" },
    startDate: { type: "STRING" },
    endDate: { type: "STRING" },
    confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
  },
  required: ["type", "title", "description", "confidence"],
} as const;
const relevanceResponseSchema = {
  type: "OBJECT",
  properties: {
    relevant: { type: "BOOLEAN" },
    confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    reason: { type: "STRING" },
    suggestedAction: { type: "STRING", enum: supportedActions },
  },
  required: ["relevant", "confidence", "reason"],
} as const;
const actionResponseSchema = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: supportedActions },
    title: { type: "STRING" },
    description: { type: "STRING" },
    payload: { type: "OBJECT" },
  },
  required: ["title", "description", "payload"],
} as const;
const thumbnailResponseSchema = { type: "OBJECT", properties: { description: { type: "STRING" }, primaryObjects: { type: "ARRAY", items: { type: "STRING" } }, visualConcepts: { type: "ARRAY", items: { type: "STRING" } }, attributes: { type: "ARRAY", items: { type: "STRING" } }, relationships: { type: "ARRAY", items: { type: "STRING" } }, activities: { type: "ARRAY", items: { type: "STRING" } }, visibleText: { type: "ARRAY", items: { type: "STRING" } }, confidence: { type: "STRING", enum: ["high", "medium", "low"] } }, required: ["description", "primaryObjects", "visualConcepts", "attributes", "relationships", "activities", "visibleText", "confidence"] } as const;
const homeInterpretationSchema = { type: "OBJECT", properties: { intent: { type: "STRING", enum: ["SEARCH_MEMORY", "CREATE_INTENTION", "UPDATE_INTENTION", "SHOW_UPCOMING", "BUILD_READY_PACK", "UPDATE_READY_PACK", "MEMORY_SELECTION", "PACK_SELECTION", "SHOW_MORE", "CLARIFICATION", "SCOPED_CONVERSATION", "OUT_OF_SCOPE"] }, tool: { type: "STRING", enum: ["searchMemories", "listUpcomingPlans", "none"] }, searchQuery: { type: "STRING" }, requiredConcepts: { type: "ARRAY", items: { type: "STRING" } }, needsClarification: { type: "BOOLEAN" }, reply: { type: "STRING" } }, required: ["intent", "tool", "searchQuery", "requiredConcepts", "needsClarification", "reply"] } as const;
const thumbnailVerificationSchema = { type: "OBJECT", properties: { matches: { type: "BOOLEAN" }, subject: { type: "STRING" }, requestedAttribute: { type: "STRING" }, evidence: { type: "STRING" }, confidence: { type: "STRING", enum: ["high", "medium", "low"] } }, required: ["matches", "subject", "requestedAttribute", "evidence", "confidence"] } as const;

function diagnosticsEnabled() {
  return process.env.VERCEL_ENV !== "production" && (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview");
}

function config() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new IntegrationError("AI_UNAVAILABLE", "Gemini API key is not configured.");
  return { apiKey, model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite", timeoutMs: Math.min(Math.max(Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || 20000), 5000), 120000) };
}

function schemaFor(operation: string) {
  switch (operation) {
    case "memory-analysis": return memoryResponseSchema;
    case "life-parsing": return lifeResponseSchema;
    case "context-relevance": return relevanceResponseSchema;
    case "action-generation": return actionResponseSchema;
    case "thumbnail-analysis": return thumbnailResponseSchema;
    case "home-interpretation": return homeInterpretationSchema;
    case "home-thumbnail-verification": return thumbnailVerificationSchema;
    default: throw new IntegrationError("VALIDATION_ERROR", "Unsupported Gemini structured operation.");
  }
}

async function request(prompt: string, operation: string, image?: { data: string; mimeType: string }): Promise<unknown> {
  const { apiKey, model, timeoutMs } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `Return exactly one JSON object matching the supplied schema. Do not return a top-level array or markdown. Use only supplied evidence and never invent facts. Operation: ${operation}\n${prompt}` }, ...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }] : [])] }], generationConfig: { temperature: 0, maxOutputTokens: operation === "thumbnail-analysis" ? 1024 : 512, responseMimeType: "application/json", responseSchema: schemaFor(operation) } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let providerStatus: string | undefined;
      let providerCode: string | number | undefined;
      try {
        const body = await response.clone().json() as { error?: { status?: unknown; code?: unknown } };
        providerStatus = typeof body.error?.status === "string" ? body.error.status : typeof body.error?.code === "string" ? body.error.code : undefined;
        providerCode = typeof body.error?.code === "number" || typeof body.error?.code === "string" ? body.error.code : undefined;
      } catch { /* keep diagnostics limited to safe HTTP metadata */ }
      if (diagnosticsEnabled()) console.warn("[gemini] failure", JSON.stringify({ operation, model, httpStatus: response.status, providerStatus, providerCode, timeout: false }));
      if (response.status === 401 || response.status === 403) throw new IntegrationError("AI_UNAVAILABLE", "Gemini authentication failed.");
      if (response.status === 429) throw new IntegrationError("RATE_LIMITED", "Gemini rate limit reached.");
      if (response.status >= 500) throw new IntegrationError("AI_UNAVAILABLE", "Gemini provider unavailable.");
      throw new IntegrationError("AI_UNAVAILABLE", "Gemini rejected the request.");
    }
    const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!text) throw new IntegrationError("AI_UNAVAILABLE", "Gemini returned no structured content.");
    try { return JSON.parse(text.replace(/^```json\s*|\s*```$/gi, "")); } catch { throw new IntegrationError("VALIDATION_ERROR", "Gemini returned invalid JSON."); }
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      if (diagnosticsEnabled()) console.warn("[gemini] failure", JSON.stringify({ operation, model, httpStatus: null, providerStatus: null, providerCode: null, timeout: true }));
      throw new IntegrationError("AI_UNAVAILABLE", "Gemini request timed out.");
    }
    throw new IntegrationError("AI_UNAVAILABLE", "Gemini request failed.");
  } finally {
    clearTimeout(timer);
    if (diagnosticsEnabled()) console.info(`[gemini] ${operation} ${Date.now() - started}ms`);
  }
}

function deterministicEmbedding(text: string): number[] {
  const vector = Array(2048).fill(0) as number[];
  for (let index = 0; index < text.length; index += 1) vector[index % 2048] = (vector[index % 2048] + text.charCodeAt(index) / 1000) % 1;
  return vector;
}

export const geminiAI: AIService = {
  async analyze({ memory, evidence }) {
    const parsed = memoryOutput.parse(await request(JSON.stringify({ task: "analyze memory", allowedCategories: ["Education & Learning", "Technology", "Food & Cooking", "Finance", "Travel", "Health & Fitness", "Work & Career", "Entertainment", "Shopping", "Personal", "Ideas & Inspiration", "Other"], evidence, source: memory.rawText || memory.title }), "memory-analysis"));
    return { memory: { ...parsed, category: normalizeCategory(parsed.category || deriveCategory(evidenceText(evidence, memory.rawText || undefined, memory.title))), tags: parsed.tags?.length ? parsed.tags : deriveTags(evidenceText(evidence, memory.rawText || undefined, memory.title)) }, metadata: { status: "complete", confidence: parsed.confidence == null ? null : Number(parsed.confidence), provider: "gemini", model: config().model, warnings: [], evidenceSources: evidence } };
  },
  async embed(text) { return deterministicEmbedding(text); },
  async parseLife({ text, timezone }) {
    const parsed = lifeOutput.parse(await request(JSON.stringify({ task: "parse life context", timezone, text, allowedTypes: lifeTypes }), "life-parsing"));
    return { contexts: [{ type: parsed.type, title: parsed.title, description: parsed.description || parsed.title, startDate: parsed.startDate || null, endDate: parsed.endDate || null, status: "active", confidence: parsed.confidence == null ? null : Number(parsed.confidence) }], metadata: { status: parsed.confidence == null ? "partial" : "complete", confidence: parsed.confidence == null ? null : Number(parsed.confidence), provider: "gemini", model: config().model, warnings: [], evidenceSources: [] } };
  },
  async evaluateRelevance(memory: Memory, life: LifeContext, similarity: number) {
    const parsed = relevanceOutput.parse(await request(JSON.stringify({ task: "evaluate relevance", memory, life, similarity, allowedActionTypes: supportedActions }), "context-relevance"));
    return { ...parsed, suggestedAction: parsed.suggestedAction || null };
  },
  async generateAction(type: ActionType, memory: Memory | null, life: LifeContext | null) {
    const parsed = actionOutput.parse(await request(JSON.stringify({ task: "generate action", requestedType: type, allowedTypes: supportedActions, memory, life }), "action-generation"));
    if (parsed.type && parsed.type !== type) throw new IntegrationError("VALIDATION_ERROR", "Gemini action type did not match the requested type.");
    return { type, title: parsed.title, description: parsed.description, payload: parsed.payload };
  },
  async analyzeThumbnail({ image, title, description, caption, platform }) {
    const parsed = thumbnailOutput.parse(await request(JSON.stringify({ title, description, caption, platform, instruction: "Analyze the image as visual evidence. Identify the primary subject before background details. Describe useful visible shape, color, pattern, design/theme, material appearance, decoration, unusual structure, and object-to-object relationships, especially when one object is designed or shaped to resemble another (for example, a cake shaped like an apron). Only return a resemblance when clearly supported; keep uncertain observations soft and do not force a novelty interpretation. Put the primary object's searchable relationship/design in visualConcepts and relationships. Background objects may be listed but are not primary concepts. Do not identify people or infer sensitive traits. Bound every list." }), "thumbnail-analysis", image));
    return parsed;
  },
  async interpretHome(input) {
    const groundedReplyPass = input.groundedReplyOnly === true;
    const parsed = homeInterpretation.parse(await request(JSON.stringify({ task: groundedReplyPass
      ? "Write one concise conversational response after a real REIBRY Memory retrieval, no more than 140 characters and one sentence. The candidate evidence below is the complete source of personal facts. Use ordinary common-sense reasoning to explain how the returned Memories may help with the user's stated goal. Do not enumerate Memory titles because the result cards show them. Never claim a Memory was saved unless its title is in candidate evidence. Do not invent contents, ingredients, plans, preferences, or evidence. Do not request another tool action; set tool to none, intent to SEARCH_MEMORY, and needsClarification false. If candidates are weak, say only that these may help."
      : "Plan one step for a bounded REIBRY conversation. Choose only a fixed intent and tool from the schema. Never invent Memories, plans or facts. Use recent turns, explicit selection state and any supplied candidate evidence to interpret follow-ups and answer grounded questions. Distinguish greetings, acknowledgement, capability, memory search, intention, plans, selection, clarification and out-of-scope. For an immediate activity goal such as wanting to bake, cook, study or prepare today, interpret the broader goal semantically and search the user's saved Memories before claiming nothing is saved; return a useful retrieval query that can match related content even when exact words differ. Do not create a Life context for casual intent phrasing alone. For a recommendation or why question, reason only from supplied candidate evidence and recent conversation; do not invent facts or preferences. For exact distinctive queries include each required concept in requiredConcepts. Never set a database mutation tool; only searchMemories or listUpcomingPlans are available. If the user wants their data searched, choose searchMemories. Maximum one retrieval/tool action is allowed."
      , conversation: { ...input, message: input.message.slice(0, 1200), recentTurns: input.recentTurns.slice(-8).map((turn) => ({ role: turn.role, text: turn.text.slice(0, 500) })), candidateTitles: input.candidateTitles.slice(0, 8), candidateEvidence: input.candidateEvidence?.slice(0, 5).map((item) => item.slice(0, 600)), rejectedMemoryIds: input.rejectedMemoryIds.slice(0, 12) } }), "home-interpretation"));
    return { ...parsed, requiredConcepts: parsed.requiredConcepts.slice(0, 8), reply: parsed.reply.trim() };
  },
  async verifyThumbnailForQuery(input) {
    const parsed = thumbnailVerification.parse(await request(JSON.stringify({ task: "Query-specific visual evidence verification. Decide only whether the named subject itself has the requested visible design or shape. Do not count incidental objects, clothing worn by a person, or background context. Be conservative; matches must be false unless clearly visible. Do not identify people or infer sensitive traits. Return short observable evidence only.", query: input.query.slice(0, 200), subject: input.subject, requestedAttribute: input.requestedAttribute.slice(0, 80), title: input.title?.slice(0, 200) || null }), "home-thumbnail-verification", input.image));
    return parsed;
  },
};
