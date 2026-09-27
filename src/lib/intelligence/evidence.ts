import type { AIAnalysisMetadata, JsonValue, Memory, MemoryContentType, SourceEvidence } from "@/types/reibry";
import { conceptTokens, semanticConcepts } from "../retrieval/concepts.ts";

export interface TranscriptResult { text: string; source: "platform-caption" | "user-uploaded-audio" | "user-uploaded-video"; confidence?: number }
export interface TranscriptProvider { transcribe(input: { mediaUrl: string; mimeType?: string; maxDurationSeconds: number }): Promise<TranscriptResult | null> }
export interface FrameEvidence { timestampSeconds: number; description?: string; imageUrl?: string }
export interface FrameSampler { sample(input: { mediaUrl: string; maxFrames: number; maxBytes: number; timeoutMs: number }): Promise<FrameEvidence[]> }
export interface OcrProvider { recognize(input: { imageUrl: string; maxCharacters: number }): Promise<{ text: string; confidence?: number } | null> }

export function evidenceLevel(evidence: SourceEvidence[], rawText: string | null): 1 | 2 | 3 | 4 | 5 | 6 {
  if (evidence.some((item) => item.frames?.length && item.onScreenText?.length)) return 6;
  if (evidence.some((item) => item.frames?.length)) return 5;
  if (evidence.some((item) => item.transcript && item.modality === "audio")) return 4;
  if (evidence.some((item) => item.transcript)) return 3;
  if (evidence.some((item) => item.metadataSource || item.modality === "metadata")) return 2;
  return rawText || evidence.some((item) => item.caption || item.title) ? 1 : 1;
}

export function classifyContentType(memory: Pick<Memory, "title" | "summary" | "rawText" | "tags" | "possibleIntents">): MemoryContentType {
  const text = `${memory.title} ${memory.summary || ""} ${memory.rawText || ""} ${memory.tags.join(" ")} ${memory.possibleIntents.join(" ")}`.toLowerCase();
  if (/\b(recipe|ingredients?|bake|cooking|servings?|frosting)\b/.test(text)) return "recipe";
  if (/\b(tutorial|course|lesson|learn|study|fastapi|python|coding|programming)\b/.test(text)) return "learning-resource";
  if (/\b(how\s+to|steps?|instructions?|guide)\b/.test(text)) return "how-to";
  if (/\b(product|price|buy|shopping|review)\b/.test(text)) return "product";
  if (/\b(event|date|conference|birthday|concert)\b/.test(text)) return "event-information";
  if (/\b(travel|trip|hotel|flight|destination)\b/.test(text)) return "travel";
  if (/\b(article|news|essay)\b/.test(text)) return "article";
  if (/\b(idea|inspiration)\b/.test(text)) return "idea";
  return "general";
}

function evidenceLines(memory: Memory) {
  return [memory.rawText, ...memory.evidenceSources.flatMap((source) => [source.caption, source.transcript, ...(source.onScreenText || [])])]
    .filter((value): value is string => Boolean(value)).flatMap((value) => value.split(/\r?\n/)).map((line) => line.trim()).filter(Boolean);
}

function recipeContent(memory: Memory): Record<string, JsonValue> {
  const lines = evidenceLines(memory);
  const ingredientLines = lines.filter((line) => /^(?:ingredients?\s*:|(?:[-*•]\s*)?(?:\d+(?:[./]\d+)?|½|¼|¾)\s+(?:(?:g|kg|ml|l|tsp|tbsp|cups?|oz|lb)\s+)?[a-z])/i.test(line)).slice(0, 30);
  const steps = lines.filter((line) => /^(?:step\s*)?\d+[.):\-]\s+|^(?:mix|add|bake|cook|heat|stir|whisk|combine|serve)\b/i.test(line)).slice(0, 20);
  const timing = lines.flatMap((line) => line.match(/\b\d+\s*(?:minutes?|mins?|hours?|hrs?)\b/gi) || []).slice(0, 5);
  return { ...(ingredientLines.length ? { ingredients: ingredientLines } : {}), ...(steps.length ? { steps } : {}), ...(timing.length ? { timing } : {}) };
}

function tutorialContent(memory: Memory): Record<string, JsonValue> {
  const concepts = [...new Set([...memory.tags, ...memory.entities.map((entity) => entity.name)])].slice(0, 12);
  return { whatItTeaches: memory.summary || memory.title, ...(concepts.length ? { keyConcepts: concepts } : {}) };
}

export function evidenceSufficiency(memory: Memory) {
  const text = evidenceLines(memory).join(" ").trim();
  const hasTitle = memory.title.trim().length > 8 && !/^captured memory$/i.test(memory.title);
  return { sufficient: hasTitle && text.length >= 80, characterCount: text.length, evidenceLevel: evidenceLevel(memory.evidenceSources, memory.rawText) };
}

export function enrichAnalysisMetadata(memory: Memory, metadata: AIAnalysisMetadata): AIAnalysisMetadata {
  const type = classifyContentType(memory);
  const structured = type === "recipe" ? recipeContent(memory) : ["tutorial", "learning-resource", "how-to"].includes(type) ? tutorialContent(memory) : {};
  const creatorTokens = new Set(memory.evidenceSources.flatMap((source) => source.author ? [...conceptTokens(source.author)] : []));
  const semanticTags = memory.tags.filter((tag) => ![...conceptTokens(tag)].some((token) => creatorTokens.has(token))).join(" ");
  return { ...metadata, analysisVersion: 2, contentType: type, evidenceLevel: evidenceLevel(memory.evidenceSources, memory.rawText), semanticConcepts: semanticConcepts([
    { text: memory.title, source: "title" }, { text: memory.summary, source: "summary" }, { text: memory.rawText, source: "raw" },
    { text: semanticTags, source: "tags" }, { text: memory.entities.filter((entity) => !/^(?:creator|author|person)$/i.test(entity.type)).map((entity) => entity.name).join(" "), source: "entities" },
    ...memory.evidenceSources.map((evidence) => ({ text: `${evidence.title || ""} ${evidence.caption || ""} ${evidence.transcript || ""} ${(evidence.onScreenText || []).join(" ")}`, source: evidence.metadataSource || evidence.platform || "evidence" })),
  ]), ...(Object.keys(structured).length ? { structuredContent: structured } : {}) };
}
