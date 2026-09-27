import { NextResponse } from "next/server";
import { z } from "zod";
import { searchMemories, verifiedStore } from "@/lib/integration/orchestrator";
import { classifyHomeIntent, intentionFromText, matchPackMemories, packTypeFor } from "@/lib/plans/service";
import { classifyHomeConversation, homeFastReply, homeSearchQuery, isChefJacketThemeCandidate } from "@/lib/plans/conversation";
import { visualRelationQuery } from "@/lib/retrieval/understanding";
import { isDuplicateLifeContext } from "@/lib/life/management";
import { activeAI } from "@/lib/integration/mock";
import { boundedHomeAgentContext, filterRejectedMemories, homeAgentToolForPlan, homeAgentPlanSchema, refinedSearchQuery, isHomeRejection, isPresentActivityGoal, isSearchRefinement, homeCandidateEvidence, shouldPlanHomeMessage } from "@/lib/agent/home-agent";
import { fetchThumbnail } from "@/lib/intelligence/thumbnail";
import type { Memory } from "@/types/reibry";
import { boundedVisualCandidates, exactCakeVisualEvidence } from "@/lib/agent/visual-match";

const uuid = z.string().uuid();
const requestSchema = z.object({
  text: z.string().trim().min(1).max(2000), timezone: z.string().trim().min(1).max(80).default("UTC"),
  conversation: z.object({
    recentTurns: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(12).default([]),
    currentTopic: z.string().max(200).nullable().default(null), candidateMemoryIds: z.array(uuid).max(12).default([]),
    rejectedMemoryIds: z.array(uuid).max(12).default([]), selectedMemoryId: uuid.nullable().default(null), hasPlan: z.boolean().default(false), planTitle: z.string().max(240).nullable().default(null),
  }).default({ recentTurns: [], currentTopic: null, candidateMemoryIds: [], rejectedMemoryIds: [], selectedMemoryId: null, hasPlan: false, planTitle: null }),
});
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });

async function verifyTopThumbnails(memories: Memory[], query: string, attribute: string) {
  const ai = activeAI({ allowFallback: false });
  if (!ai.verifyThumbnailForQuery) return [];
  const candidates = boundedVisualCandidates(memories.filter((memory) => memory.sourceType !== "text" && memory.analysisStatus !== "failed"));
  const verified: Array<{ memory: Memory; similarity: number; reason: string }> = [];
  for (const memory of candidates) {
    const thumbnail = memory.evidenceSources.find((source) => source.thumbnail)?.thumbnail;
    if (!thumbnail) continue;
    const image = await fetchThumbnail(thumbnail);
    if (!image) continue;
    try {
      const result = await ai.verifyThumbnailForQuery({ image, query, subject: "cake", requestedAttribute: attribute, title: memory.title });
      if (result?.matches && result.confidence === "high" && /cake/i.test(result.subject) && result.requestedAttribute.toLowerCase().includes(attribute.toLowerCase()) && result.evidence.trim()) {
        verified.push({ memory, similarity: 1, reason: `The source thumbnail shows ${result.evidence.trim()}` });
      }
    } catch { /* Visual verification is optional; ordinary grounded search remains the result. */ }
  }
  return verified;
}

export async function POST(request: Request) {
  const started = performance.now();
  try {
    const input = requestSchema.parse(await request.json());
    const routeStarted = performance.now();
    const routedIntent = classifyHomeConversation(input.text, { hasOptions: input.conversation.candidateMemoryIds.length > 0, hasPlan: input.conversation.hasPlan });
    const fastReply = homeFastReply(routedIntent, input.text, { hasPlan: input.conversation.hasPlan, planTitle: input.conversation.planTitle || undefined });
    if (fastReply && ["GREETING", "ACKNOWLEDGEMENT", "CAPABILITY_QUESTION", "OUT_OF_SCOPE"].includes(routedIntent)) {
      if (process.env.NODE_ENV !== "production") console.info("[home] local route", { intent: routedIntent, elapsedMs: Math.round(performance.now() - started), databaseOperations: 0, retrievalOperations: 0, providerCalls: 0 });
      return privateJson({ data: { intent: routedIntent, message: fastReply, blocks: [], actions: [] }, error: null });
    }

    const { store } = await verifiedStore();
    // Conversational references are reloaded through the authenticated user's store; the browser supplies IDs only.
    const candidateIds = [...new Set(input.conversation.candidateMemoryIds)];
    const [candidateMemories, suppliedRejected] = await Promise.all([
      candidateIds.length ? store.getMemories(candidateIds) : Promise.resolve([] as Memory[]),
      input.conversation.rejectedMemoryIds.length ? store.getMemories(input.conversation.rejectedMemoryIds) : Promise.resolve([] as Memory[]),
    ]);
    const ownedRejectedIds = new Set(suppliedRejected.map((memory) => memory.id));
    const rejectedIds = input.conversation.rejectedMemoryIds.filter((id) => ownedRejectedIds.has(id));
    const agentContext = boundedHomeAgentContext({
      message: input.text, recentTurns: input.conversation.recentTurns,
      currentTopic: input.conversation.currentTopic, candidateTitles: candidateMemories.map((memory) => memory.title),
      candidateEvidence: candidateMemories.slice(0, 5).map((memory) => homeCandidateEvidence(memory)),
      rejectedMemoryIds: rejectedIds, hasPlan: input.conversation.hasPlan,
    });

    let intent = classifyHomeIntent(input.text);
    let searchQuery = homeSearchQuery(input.text);
    let planner = null as Awaited<ReturnType<NonNullable<ReturnType<typeof activeAI>["interpretHome"]>>>;
    let providerCalls = 0;
    const refinementQuery = refinedSearchQuery(input.text, input.conversation.currentTopic);
    const refinement = Boolean(input.conversation.currentTopic && isSearchRefinement(input.text, input.conversation.currentTopic) && refinementQuery !== input.text);
    if (refinement) { intent = "SEARCH_MEMORY"; searchQuery = refinementQuery; }
    if (isHomeRejection(input.text) && input.conversation.currentTopic) { intent = "SEARCH_MEMORY"; searchQuery = input.conversation.currentTopic; }
    if (routedIntent === "SEARCH_MEMORY" && intent === "UNKNOWN") intent = "SEARCH_MEMORY";

    // The planner is called only after the deterministic casual/command paths and receives bounded, user-scoped context.
    const presentActivityGoal = isPresentActivityGoal(input.text);
    if (shouldPlanHomeMessage(intent, refinement, isHomeRejection(input.text), input.text)) {
      try {
        const planned = await activeAI({ allowFallback: false }).interpretHome?.(agentContext);
        if (planned) {
          providerCalls++;
          planner = homeAgentPlanSchema.parse(planned);
          const tool = homeAgentToolForPlan(planner);
          if (!presentActivityGoal && (planner.needsClarification || planner.intent === "CLARIFICATION")) return privateJson({ data: { intent: "CLARIFICATION", message: planner.reply || "What detail would help me narrow this down?", results: [] }, error: null });
          if (!presentActivityGoal && planner.intent === "OUT_OF_SCOPE") return privateJson({ data: { intent: "OUT_OF_SCOPE", message: planner.reply || homeFastReply("OUT_OF_SCOPE", input.text), blocks: [], actions: [] }, error: null });
          if (presentActivityGoal) { intent = "SEARCH_MEMORY"; searchQuery = planner.searchQuery || searchQuery; }
          else if (tool === "searchMemories") { intent = "SEARCH_MEMORY"; searchQuery = planner.searchQuery || searchQuery; }
          else if (tool === "listUpcomingPlans") intent = "SHOW_UPCOMING";
          else if (planner.intent === "CREATE_INTENTION" || planner.intent === "UPDATE_INTENTION") intent = "CREATE_INTENTION";
          else if (planner.intent === "SCOPED_CONVERSATION") return privateJson({ data: { intent: "SCOPED_CONVERSATION", message: planner.reply || "What detail do you remember about it?", blocks: [], actions: [] }, error: null });
        }
      } catch { planner = null; /* deterministic fallback below remains available */ }
    }

    // If semantic planning is unavailable, an activity goal still gets a real retrieval attempt before any no-match response.
    if (presentActivityGoal && intent !== "SEARCH_MEMORY") { intent = "SEARCH_MEMORY"; searchQuery = homeSearchQuery(input.text); }

    if (intent === "UNKNOWN" && routedIntent === "SEARCH_MEMORY") intent = "SEARCH_MEMORY";
    if (intent === "UNKNOWN" && /\b(?:saved|stored|memory|memories|video|clip|recipe|tutorial|cake|butterfly|orange juice)\b/i.test(input.text)) intent = "SEARCH_MEMORY";
    if (intent === "UNKNOWN") {
      const reply = planner?.reply || (input.conversation.currentTopic ? `I’m still looking at ${input.conversation.currentTopic}. What detail should I use to narrow it down?` : `I’m not sure what you mean by “${input.text.trim().slice(0, 80)}”. Are you trying to find a saved item, or tell me about a plan?`);
      return privateJson({ data: { intent: "CLARIFICATION", message: reply, blocks: [], actions: [] }, error: null });
    }
    if (intent === "SHOW_UPCOMING") {
      const [contexts, packs] = await Promise.all([store.listForToday("life_contexts"), store.list("ready_packs")]);
      return privateJson({ data: { intent, contexts: contexts.filter((item) => item.status === "active").slice(0, 3), packs: packs.filter((pack) => pack.status === "active").slice(0, 3) }, error: null });
    }
    if (intent === "SEARCH_MEMORY") {
      const results = filterRejectedMemories(await searchMemories({ query: searchQuery, limit: 10 }, store.userId), rejectedIds);
      const relation = visualRelationQuery(searchQuery);
      if (!results.length && relation?.object === "cake") {
        const likely = await searchMemories({ query: "cake", limit: 3 }, store.userId);
        const previewMatches = await verifyTopThumbnails(likely.map((item) => item.memory), searchQuery, relation.design);
        if (previewMatches.length) return privateJson({ data: { intent: "SEARCH_MEMORY", results: previewMatches, exact: true, verifiedFromThumbnail: true, query: searchQuery, message: "I checked a few saved cake previews and found one with those details." }, error: null });
      }
      // A distinctive visual request cannot be satisfied by a merely similar cake.
      const exactResults = relation?.object === "cake" ? results.filter((item) => exactCakeVisualEvidence(item.memory, relation.design)) : results;
      if (!exactResults.length && relation?.object === "cake") {
        return privateJson({ data: { intent: "SEARCH_MEMORY", results: [], exact: false, query: searchQuery, message: `I couldn’t find a saved cake with ${relation.design} details.` }, error: null });
      }
      if (!exactResults.length && visualRelationQuery(input.text)?.design === "apron") {
        const alternatives = await searchMemories({ query: "chef jacket shaped cake", limit: 1 }, store.userId);
        if (alternatives[0] && isChefJacketThemeCandidate(alternatives[0].memory)) {
          return privateJson({ data: { intent: "CLARIFICATION", message: `I found “${alternatives[0].memory.title}”, and its source preview describes a chef-jacket-themed cake. I can't confirm it's apron-shaped. Is this the one you meant?`, results: alternatives }, error: null });
        }
      }
      let message: string | null = null;
      if (planner && exactResults.length) {
        try {
          const grounded = await activeAI({ allowFallback: false }).interpretHome?.(boundedHomeAgentContext({
            ...agentContext,
            message: input.text,
            currentTopic: searchQuery,
            candidateTitles: exactResults.slice(0, 5).map((item) => item.memory.title),
            candidateEvidence: exactResults.slice(0, 5).map((item) => homeCandidateEvidence(item.memory)),
            groundedReplyOnly: true,
          }));
          if (grounded?.reply.trim()) { providerCalls++; message = grounded.reply.trim(); }
        } catch { /* Ranked Memories remain useful without an AI-written explanation. */ }
      }
      if (process.env.NODE_ENV !== "production") console.info("[home] search complete", { elapsedMs: Math.round(performance.now() - started), routeMs: Math.round(performance.now() - routeStarted), results: exactResults.length, toolRounds: 1, providerCalls });
      return privateJson({ data: { intent, results: exactResults, exact: true, query: searchQuery, message }, error: null });
    }

    // Common intention statements are handled deterministically so provider failure cannot lose a plan.
    const candidate = intentionFromText(input.text, input.timezone, new Date());
    const existing = (await store.listForToday("life_contexts")).find((context) => context.type === candidate.type && isDuplicateLifeContext(context, candidate));
    const context = existing || (await store.insertLife([candidate]))[0];
    const type = packTypeFor(context);
    let matches: Awaited<ReturnType<typeof matchPackMemories>> = [];
    if (type) {
      const anchors = `${context.title} ${context.description || ""}`;
      const queries = type === "travel" ? anchors.split(/\s+/).filter((word) => word.length > 2).slice(0, 4) : type === "learning" ? [anchors] : ["cake", "gift idea", "birthday restaurant", "birthday activity"];
      const pages = await Promise.all([store.listMemories({ limit: type === "event" ? 40 : 20 }), ...queries.map((query) => store.listMemories({ limit: 20, search: query }))]);
      const boundedMemories = [...new Map(pages.flatMap((page) => page.items).map((memory) => [memory.id, memory])).values()];
      matches = await matchPackMemories(context, boundedMemories, type);
    }
    if (process.env.NODE_ENV !== "production") console.info("[home] intention handled", { elapsedMs: Math.round(performance.now() - started), reused: Boolean(existing), candidateCount: matches.length, type });
    return privateJson({ data: { intent: "CREATE_INTENTION", context, matches, packType: type, analysisStatus: "partial" }, error: null });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    if (process.env.NODE_ENV !== "production") console.warn("[home] request failed", { elapsedMs: Math.round(performance.now() - started), errorType: error instanceof Error ? error.name : "UnknownError" });
    return privateJson({ data: null, error: { code: status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR", message: status === 400 ? "Tell REIBRY what you are trying to do." : "REIBRY could not complete that request." } }, status);
  }
}
