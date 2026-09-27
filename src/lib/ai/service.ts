import type { AIAnalysisMetadata, LifeContext, Memory, SourceEvidence } from "@/types/reibry";
import { NotImplementedError } from "@/lib/utils/errors";

/** Person 2 implements this provider-neutral contract. Embeddings must have 2048 finite values. */
export interface AIService {
  analyze(input: { memory: Memory; evidence: SourceEvidence[] }): Promise<{ memory: Partial<Pick<Memory, "title" | "summary" | "category" | "tags" | "entities" | "possibleIntents" | "possibleActions">>; metadata: AIAnalysisMetadata }>;
  embed(text: string): Promise<number[]>;
  parseLife(input: { text: string; timezone: string }): Promise<{ contexts: Omit<LifeContext, "id" | "userId" | "createdAt" | "updatedAt">[]; metadata: AIAnalysisMetadata }>;
  evaluateRelevance?(memory: Memory, life: LifeContext, similarity: number): Promise<{ relevant: boolean; confidence: number; reason: string; suggestedAction?: unknown | null }>;
  generateAction?(type: Memory["possibleActions"][number]["type"] | string, memory: Memory | null, life: LifeContext | null): Promise<{ type: string; title: string; description?: string; payload: Record<string, unknown> }>;
  analyzeThumbnail?(input: { image: { data: string; mimeType: string }; title?: string; description?: string; caption?: string; platform?: string }): Promise<{ description: string; primaryObjects: string[]; visualConcepts: string[]; attributes: string[]; relationships: string[]; activities: string[]; visibleText: string[]; confidence: "high" | "medium" | "low" } | null>;
  interpretHome?(input: { message: string; recentTurns: Array<{ role: "user" | "assistant"; text: string }>; currentTopic: string | null; candidateTitles: string[]; candidateEvidence?: string[]; groundedReplyOnly?: boolean; rejectedMemoryIds: string[]; hasPlan: boolean }): Promise<{ intent: "SEARCH_MEMORY" | "CREATE_INTENTION" | "UPDATE_INTENTION" | "SHOW_UPCOMING" | "BUILD_READY_PACK" | "UPDATE_READY_PACK" | "MEMORY_SELECTION" | "PACK_SELECTION" | "SHOW_MORE" | "CLARIFICATION" | "SCOPED_CONVERSATION" | "OUT_OF_SCOPE"; tool: "searchMemories" | "listUpcomingPlans" | "none"; searchQuery: string; requiredConcepts: string[]; needsClarification: boolean; reply: string } | null>;
  verifyThumbnailForQuery?(input: { image: { data: string; mimeType: string }; query: string; subject: string; requestedAttribute: string; title?: string }): Promise<{ matches: boolean; subject: string; requestedAttribute: string; evidence: string; confidence: "high" | "medium" | "low" } | null>;
}
export const aiService: AIService = {
  async analyze() { throw new NotImplementedError("AI analysis"); },
  async embed() { throw new NotImplementedError("Embedding generation"); },
  async parseLife() { throw new NotImplementedError("Life text parsing"); },
};
