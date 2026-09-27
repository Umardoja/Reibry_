import type { Memory } from "../../types/reibry.ts";

/** Add grounded visual/topic evidence to the existing deterministic embedding input. */
export function memoryEmbeddingText(memory: Memory) {
  return [memory.title, memory.summary, memory.category, ...memory.tags, ...memory.possibleIntents, ...(memory.analysisMetadata?.semanticConcepts || []).map((item) => item.concept), ...(memory.analysisMetadata?.visualEvidence?.concepts || []), ...(memory.analysisMetadata?.visualEvidence?.relationships || [])].filter(Boolean).join("\n");
}
