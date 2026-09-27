import type { ContextMatch, LifeContext, Memory, TodayResurfacedMemory } from "@/types/reibry";

export const MAX_SURFACED_ITEMS = 3;

export function rankResurfacedMemories(matches: ContextMatch[], contexts: LifeContext[], memories: Memory[]): TodayResurfacedMemory[] {
  const now = Date.now();
  const contextById = new Map(contexts.map((context) => [context.id, context]));
  const memoryById = new Map(memories.map((memory) => [memory.id, memory]));
  const seenMemoryIds = new Set<string>();
  return matches
    .filter((match) => match.status !== "dismissed" && (!match.shownAt || match.confidence === null || match.confidence >= 0.5))
    .map((match) => ({ match, memory: memoryById.get(match.memoryId), lifeContext: contextById.get(match.lifeContextId) }))
    .filter((item): item is { match: ContextMatch; memory: Memory; lifeContext: LifeContext } => {
      return Boolean(item.memory && item.lifeContext && (item.memory.analysisStatus === "complete" || item.memory.analysisStatus === "partial"));
    })
    .sort((a, b) => {
      const proximity = (item: typeof a) => { const time = item.lifeContext.startDate ? Date.parse(item.lifeContext.startDate) : NaN; if (Number.isNaN(time)) return 0; const days = Math.abs(time - now) / 86_400_000; return days <= 1 ? 0.12 : days <= 3 ? 0.06 : days <= 7 ? 0.02 : 0; };
      return ((b.match.similarity + proximity(b)) - (a.match.similarity + proximity(a))) || ((b.match.confidence ?? 0) - (a.match.confidence ?? 0));
    })
    .filter(({ memory }) => {
      if (seenMemoryIds.has(memory.id)) return false;
      seenMemoryIds.add(memory.id);
      return true;
    })
    .slice(0, MAX_SURFACED_ITEMS)
    .map(({ match, memory, lifeContext }) => ({ memory, lifeContext, reason: match.reason, similarity: match.similarity, confidence: match.confidence, status: match.status, suggestedAction: match.suggestedAction }));
}
