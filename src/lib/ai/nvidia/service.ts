import type { ActionType } from "@/types/reibry";
import type { AIService } from "../service";
import { IntegrationError } from "../../integration/errors.ts";
import { analyzeMemory, evaluateRelevance, generateAction, parseLife } from "./reasoning.ts";
import { embedQuery } from "./embeddings.ts";
import { analyzeMultimodal, failedMultimodalAnalysis, hasUsefulMultimodalEvidence, hasUsefulTextEvidence } from "./multimodal.ts";

export const nvidiaAI: AIService = {
  async analyze(input) {
    if (!hasUsefulMultimodalEvidence(input.evidence)) {
      if (!hasUsefulTextEvidence(input.evidence)) return failedMultimodalAnalysis(input.memory, input.evidence, "No useful evidence was supplied.");
      return analyzeMemory(input.memory, input.evidence);
    }
    try {
      return await analyzeMultimodal(input.memory, input.evidence);
    } catch (error) {
      if (error instanceof IntegrationError && error.code === "SOURCE_UNAVAILABLE") throw error;
      if (!hasUsefulTextEvidence(input.evidence)) throw error;
      const fallback = await analyzeMemory(input.memory, input.evidence);
      return {
        memory: fallback.memory,
        metadata: {
          ...fallback.metadata,
          status: "partial",
          confidence: fallback.metadata.confidence === null ? null : Math.min(fallback.metadata.confidence, 0.5),
          warnings: [...fallback.metadata.warnings, "Multimodal analysis failed; text evidence fallback was used."],
          evidenceSources: input.evidence.map((source) => ({ ...source, modality: source.modality || "text" as const })),
        },
      };
    }
  },
  async embed(text) { return embedQuery(text); },
  async parseLife(input) { return parseLife(input.text, input.timezone); },
  async evaluateRelevance(memory, life, similarity) { return evaluateRelevance(memory, life, similarity); },
  async generateAction(type, memory, life) { return generateAction(type as ActionType, memory, life); },
};
