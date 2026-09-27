import type { AIService } from "@/lib/ai/service";
import { nvidiaAI } from "@/lib/ai/nvidia/service";
import { geminiAI } from "@/lib/integration/gemini";
import type { ActionType } from "@/types/reibry";
import { deriveCategory, deriveTags, evidenceText, normalizeCategory } from "@/lib/sources/enrichment";

const relevanceStopWords = new Set(["a", "an", "and", "are", "for", "in", "is", "it", "of", "on", "or", "the", "this", "to", "was"]);

export const mockAI: AIService = {
  async analyze({ memory, evidence }) {
    const sourceText = evidenceText(evidence, memory.rawText || undefined, memory.title);
    const tags = deriveTags(sourceText);
    const lower = sourceText.toLowerCase();
    const possibleIntents = [
      /\b(learn|study|course|tutorial|practice|equation|programming)\b/.test(lower) ? "learn" : null,
      /\b(recipe|cook|bake|cake|food)\b/.test(lower) ? "cook" : null,
      /\b(buy|shop|price|budget|product)\b/.test(lower) ? "buy" : null,
      /\b(plan|trip|travel|prepare)\b/.test(lower) ? "plan" : null,
      /\b(read|article|research|watch|video)\b/.test(lower) ? "research" : null,
    ].filter((value): value is string => Boolean(value));
    const entityMatch = sourceText.match(/\b(?:Rolex|Python|JavaScript|YouTube|TikTok|Instagram)\b/gi);
    return {
      memory: {
        title: memory.title || "Captured memory",
        summary: sourceText.slice(0, 280) || null,
        category: normalizeCategory(deriveCategory(sourceText)),
        tags,
        entities: [...new Set(entityMatch || [])].map((name) => ({ name, type: "topic" })),
        possibleIntents: [...new Set(possibleIntents)],
        possibleActions: [],
      },
      metadata: {
        status: "partial",
        confidence: 0.5,
        provider: "mock", providerUsed: "mock",
        warnings: ["Deterministic mock analysis"],
        evidenceSources: evidence,
      },
    };
  },
  async embed(text) {
    const a = Array(2048).fill(0);
    for (let i = 0; i < text.length; i++) a[i % 2048] = (a[i % 2048] + text.charCodeAt(i) / 1000) % 1;
    return a;
  },
  async parseLife({ text }) {
    return {
      contexts: [{
        type: "task",
        title: text.slice(0, 300),
        description: text,
        startDate: null,
        endDate: null,
        status: "active",
        confidence: 0.5,
      }],
      metadata: {
        status: "partial",
        confidence: 0.5,
        provider: "mock", providerUsed: "mock",
        warnings: ["Deterministic mock parser"],
        evidenceSources: [],
      },
    };
  },
  async evaluateRelevance(memory, life, similarity) {
    const terms = new Set(`${life.title} ${life.description || ""}`.toLowerCase().split(/\W+/).filter((term) => term && !relevanceStopWords.has(term)));
    const haystack = `${memory.title} ${memory.summary || ""} ${memory.tags.join(" ")} ${memory.possibleIntents.join(" ")}`.toLowerCase();
    const hits = [...terms].filter((term) => haystack.includes(term)).length;
    const confidence = terms.size ? Math.max(similarity, hits / terms.size) : 0;
    return {
      relevant: confidence >= 0.25,
      confidence,
      reason: `You saved “${memory.title}”, which relates to “${life.title}”.`,
      suggestedAction: null,
    };
  },
  async generateAction(type, memory, life) {
    const supported = new Set<ActionType>(["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"]);
    if (!supported.has(type as ActionType)) throw new Error("Unsupported action type.");
    const source = memory?.id || life?.id || "";
    return {
      type,
      title: type.replaceAll("_", " "),
      description: "Mock action proposal requiring confirmation.",
      payload: { source },
    };
  },
  async analyzeThumbnail() { return null; },
  async interpretHome() { return null; },
  async verifyThumbnailForQuery() { return null; },
};

function fallbackReason(error: unknown): "timeout" | "network_error" | "provider_error" | "invalid_response" { const message = error instanceof Error ? error.message.toLowerCase() : ""; return message.includes("timed out") || error instanceof Error && error.name === "AbortError" ? "timeout" : message.includes("invalid") || message.includes("schema") ? "invalid_response" : message.includes("unavailable") || message.includes("network") ? "network_error" : "provider_error"; }

function withFallback(provider: AIService, fallback: AIService): AIService {
  return {
    async analyze(input) {
      try { return await provider.analyze(input); }
      catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[ai] falling back to mock analysis", error instanceof Error ? error.message : "unknown error");
        const result = await fallback.analyze(input); return { ...result, metadata: { ...result.metadata, providerUsed: "fallback", fallbackReason: fallbackReason(error) } };
      }
    },
    async embed(text) {
      try { return await provider.embed(text); }
      catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[ai] falling back to mock embedding", error instanceof Error ? error.message : "unknown error");
        return fallback.embed(text);
      }
    },
    async parseLife(input) {
      try { return await provider.parseLife(input); }
      catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[ai] falling back to mock life parsing", error instanceof Error ? error.message : "unknown error");
        const result = await fallback.parseLife(input); return { ...result, metadata: { ...result.metadata, providerUsed: "fallback", fallbackReason: fallbackReason(error) } };
      }
    },
    async evaluateRelevance(memory, life, similarity) {
      try {
        if (!provider.evaluateRelevance) throw new Error("Provider relevance evaluation unavailable.");
        return await provider.evaluateRelevance(memory, life, similarity);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[ai] falling back to mock relevance", error instanceof Error ? error.message : "unknown error");
        if (!fallback.evaluateRelevance) throw error;
        return fallback.evaluateRelevance(memory, life, similarity);
      }
    },
    async generateAction(type, memory, life) {
      try {
        if (!provider.generateAction) throw new Error("Provider action generation unavailable.");
        return await provider.generateAction(type, memory, life);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn("[ai] falling back to mock action", error instanceof Error ? error.message : "unknown error");
        if (!fallback.generateAction) throw error;
        return fallback.generateAction(type, memory, life);
      }
    },
    async analyzeThumbnail(input) {
      try { return provider.analyzeThumbnail ? await provider.analyzeThumbnail(input) : null; }
      catch { return fallback.analyzeThumbnail ? fallback.analyzeThumbnail(input) : null; }
    },
    async interpretHome(input) {
      try { return provider.interpretHome ? await provider.interpretHome(input) : null; }
      catch { return fallback.interpretHome ? fallback.interpretHome(input) : null; }
    },
    async verifyThumbnailForQuery(input) { try { return provider.verifyThumbnailForQuery ? await provider.verifyThumbnailForQuery(input) : null; } catch { return fallback.verifyThumbnailForQuery ? fallback.verifyThumbnailForQuery(input) : null; } },
  };
}

export function activeAI(options: { allowFallback?: boolean } = {}) {
  const provider = process.env.AI_PROVIDER || "mock";
  if (provider === "mock") {
    if (process.env.NODE_ENV !== "production") console.info("[ai] provider-selected", { provider, fallback: false });
    return mockAI;
  }
  if (provider === "nvidia") {
    const fallbackEnabled = options.allowFallback !== false && process.env.AI_ALLOW_MOCK_FALLBACK !== "false";
    if (process.env.NODE_ENV !== "production") console.info("[ai-config]", { provider, fallbackAllowed: fallbackEnabled, structuredTimeoutMs: Number(process.env.NVIDIA_STRUCTURED_TIMEOUT_MS || 20000) });
    return fallbackEnabled ? withFallback(nvidiaAI, mockAI) : nvidiaAI;
  }
  if (provider === "gemini") {
    const fallbackEnabled = options.allowFallback !== false && process.env.AI_ALLOW_MOCK_FALLBACK !== "false";
    if (process.env.NODE_ENV !== "production") console.info("[ai] provider-selected", { provider: "gemini", fallback: fallbackEnabled });
    return fallbackEnabled ? withFallback(geminiAI, mockAI) : geminiAI;
  }
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
