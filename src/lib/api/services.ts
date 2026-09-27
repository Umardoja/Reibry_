import "server-only";
import type { CaptureRequest, AnalyzeRequest, SearchRequest, ParseLifeRequest, MatchRequest, ActionRequest, FeedbackRequest } from "./contracts";
import type { AIAnalysisMetadata, Memory } from "@/types/reibry";
import { capture as captureFlow, parseAndSaveLife } from "@/lib/integration/orchestrator";

// Integrator owns persistence and authorization; AI must never fetch arbitrary user records.
export interface MemoryService {
  capture(input: CaptureRequest, userId: string): Promise<{ memory: Memory; duplicate: boolean }>;
  analyze(input: AnalyzeRequest, userId: string): Promise<{ memory: Memory; metadata: AIAnalysisMetadata }>;
}
export const memoryService: MemoryService = {
  async capture(input) { return captureFlow(input); },
  async analyze() { throw new Error("Use capture orchestration or a provider implementation."); },
};
export const services = {
  capture: memoryService.capture,
  analyze: memoryService.analyze,
  search: async (input: SearchRequest, userId: string) => ({ results: await (await import("@/lib/integration/orchestrator")).searchMemories(input, userId) }),
  parseLife: async (input: ParseLifeRequest) => parseAndSaveLife(input),
  match: async (input: MatchRequest) => ({ matches: await (await import("@/lib/integration/orchestrator")).matchContext(input) }),
  action: async (input: ActionRequest, userId: string) => ({ action: await (await import("@/lib/integration/orchestrator")).generateAction(input, userId) }),
  feedback: async (input: FeedbackRequest) => (await import("@/lib/integration/orchestrator")).feedback(input),
};
