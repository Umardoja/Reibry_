import { z } from "zod";

export const HOME_AGENT_MAX_ROUNDS = 2;
export const HOME_AGENT_TOOLS = ["searchMemories", "listUpcomingPlans", "none"] as const;
export const homeAgentPlanSchema = z.object({
  intent: z.enum(["SEARCH_MEMORY", "CREATE_INTENTION", "UPDATE_INTENTION", "SHOW_UPCOMING", "BUILD_READY_PACK", "UPDATE_READY_PACK", "MEMORY_SELECTION", "PACK_SELECTION", "SHOW_MORE", "CLARIFICATION", "SCOPED_CONVERSATION", "OUT_OF_SCOPE"]),
  tool: z.enum(HOME_AGENT_TOOLS), searchQuery: z.string().max(200), requiredConcepts: z.array(z.string().max(80)).max(8),
  needsClarification: z.boolean(), reply: z.string().max(300),
});
export type HomeAgentPlan = z.infer<typeof homeAgentPlanSchema>;
export type HomeAgentTool = (typeof HOME_AGENT_TOOLS)[number];

export type HomeAgentContext = {
  message: string;
  recentTurns: Array<{ role: "user" | "assistant"; text: string }>;
  currentTopic: string | null;
  candidateTitles: string[];
  candidateEvidence?: string[];
  groundedReplyOnly?: boolean;
  rejectedMemoryIds: string[];
  hasPlan: boolean;
};

export function boundedHomeAgentContext(context: HomeAgentContext): HomeAgentContext {
  return {
    message: context.message.slice(0, 1200),
    recentTurns: context.recentTurns.slice(-8).map(({ role, text }) => ({ role, text: text.slice(0, 500) })),
    currentTopic: context.currentTopic?.slice(0, 200) || null,
    candidateTitles: context.candidateTitles.slice(0, 8).map((title) => title.slice(0, 240)),
    candidateEvidence: context.candidateEvidence?.slice(0, 5).map((item) => item.slice(0, 600)),
    groundedReplyOnly: context.groundedReplyOnly === true,
    rejectedMemoryIds: context.rejectedMemoryIds.slice(0, 12),
    hasPlan: context.hasPlan,
  };
}

export function homeAgentToolForPlan(plan: HomeAgentPlan): HomeAgentTool {
  if (plan.intent === "SEARCH_MEMORY" && plan.tool === "searchMemories") return "searchMemories";
  if (plan.intent === "SHOW_UPCOMING" && plan.tool === "listUpcomingPlans") return "listUpcomingPlans";
  return "none";
}

export function isPresentActivityGoal(text: string) {
  return /^(?:i want to|i really want to|i would like to|i would really like to|i'd like to|i need to)\b/i.test(text.trim());
}

export function shouldPlanHomeMessage(intent: string, refinement: boolean, rejection: boolean, text = "") {
  if (refinement || rejection || ["SEARCH_MEMORY", "SHOW_UPCOMING"].includes(intent)) return false;
  if (intent === "CREATE_INTENTION") return isPresentActivityGoal(text);
  return true;
}

export function isHomeRejection(text: string) {
  return /^(?:no[, ]*)?(?:that'?s? not it|not that one|wrong one|not this one|nope,? not that)$/i.test(text.trim());
}

export function isSearchRefinement(text: string, currentTopic: string | null) {
  if (!currentTopic || /^(?:no|thanks|okay|cool)$/i.test(text.trim())) return false;
  const current = currentTopic.toLowerCase();
  const value = text.toLowerCase();
  if (/^(?:what|how) about\b/.test(value) || /^(?:what else do i have|show me more|show me the rest)\??$/.test(value.trim())) return true;
  if (/^(?:the )?(?:butterfly|heart|red velvet|chocolate) one\??$/i.test(value.trim())) return true;
  const topicTerms = current.match(/[a-z0-9]+/g) || [];
  return topicTerms.some((term) => term.length > 3 && value.includes(term)) && value.trim().split(/\s+/).length <= 7;
}

export function refinedSearchQuery(text: string, currentTopic: string | null) {
  const refinement = text.trim().replace(/^(?:yes[, ]*|actually[, ]*|i meant[, ]*|what about\s*|how about\s*)/i, "").replace(/^(?:a |the )/i, "").replace(/[?!.]+$/, "");
  const prior = (currentTopic || "").toLowerCase();
  // Carry the existing object/topic forward when the correction names only a visual attribute.
  if (/\b(?:butterfly|heart|apron|chef jacket)\b/i.test(refinement) && /\bcake\b/i.test(prior) && !/\bcake\b/i.test(refinement)) return `${refinement} cake`;
  return refinement.slice(0, 200);
}

export function filterRejectedMemories<T extends { memory: { id: string } }>(items: T[], rejectedIds: string[]) {
  const rejected = new Set(rejectedIds.slice(0, 12));
  return items.filter((item) => !rejected.has(item.memory.id));
}

/** Minimal candidate evidence for one grounded Home response pass. */
export function homeCandidateEvidence(memory: {
  title: string; summary?: string | null; tags?: string[]; entities?: Array<{ name: string }>;
  sourcePlatform?: string | null; analysisMetadata?: { visualEvidence?: { analyzed?: boolean; concepts?: string[]; visualDescription?: string | null } | null } | null;
}) {
  const visual = memory.analysisMetadata?.visualEvidence?.analyzed ? memory.analysisMetadata.visualEvidence : null;
  return [
    `Title: ${memory.title}`,
    memory.summary ? `Summary: ${memory.summary.slice(0, 220)}` : "",
    memory.tags?.length ? `Tags: ${memory.tags.slice(0, 6).join(", ")}` : "",
    memory.entities?.length ? `Topics: ${memory.entities.slice(0, 6).map((item) => item.name).join(", ")}` : "",
    memory.sourcePlatform ? `Source: ${memory.sourcePlatform}` : "",
    visual?.concepts?.length ? `Thumbnail concepts: ${visual.concepts.slice(0, 8).join(", ")}` : "",
    visual?.visualDescription ? `Thumbnail evidence: ${visual.visualDescription.slice(0, 180)}` : "",
  ].filter(Boolean).join("\n").slice(0, 600);
}

/** Recover the last item the user explicitly rejected for a grounded follow-up explanation. */
export function lastRejectedCandidate<TMemory>(turns: Array<{ role: string; text?: string; block?: { kind?: string; text?: string; results?: Array<{ memory: TMemory }> } }>): TMemory | null {
  let rejectionIndex = -1;
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index];
    if (turn.role !== "assistant") continue;
    rejectionIndex = index;
    const assistantText = turn.block?.text || turn.text || "";
    if (!isHomeRejection(assistantText) && !/^got it — not that one\b/i.test(assistantText)) return null;
    break;
  }
  if (rejectionIndex < 0) return null;
  for (let index = rejectionIndex - 1; index >= 0; index--) {
    const turn = turns[index];
    const first = turn.role === "assistant" && turn.block?.kind === "search" ? turn.block.results?.[0]?.memory : undefined;
    if (first) return first;
  }
  return null;
}
