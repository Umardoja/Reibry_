import type {
  AIAnalysisMetadata,
  ActionType,
  LifeContext,
  Memory,
  SourceEvidence,
  SuggestedAction,
} from "../../../types/reibry.ts";
import { lifeResult } from "../../integration/schemas.ts";
import { z } from "zod";
import { nvidiaConfig } from "./config.ts";
import { nvidiaRequest } from "./client.ts";
import { NvidiaDiagnosticError, logNvidiaFailure } from "./errors.ts";

export const memoryOutput = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().max(20000).nullable().optional(),
  category: z.string().trim().max(300).nullable().optional(),
  tags: z.array(z.string()).optional(),
  entities: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
  possibleIntents: z.array(z.string()).optional(),
  possibleActions: z.array(z.object({
    type: z.enum(["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"]),
    title: z.string(),
    description: z.string().optional(),
    payload: z.record(z.string(), z.json()),
  })).optional(),
  confidence: z.union([z.number().finite().min(0).max(1), z.string().regex(/^(?:0(?:\\.\\d+)?|1(?:\\.0+)?)$/).transform(Number)]).nullable().optional(),
});

function extractAssistantContent(value: unknown): string {
  const raw = (value as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  if (Array.isArray(raw)) {
    return raw
      .filter((part): part is { type?: string; text?: string } => typeof part === "object" && part !== null)
      .filter((part) => part.type === "text" || !part.type)
      .map((part) => part.text || "")
      .join("");
  }
  return typeof raw === "string" ? raw : "";
}

function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

export const json = (value: unknown, label = "memory-analysis") => {
  const raw = (value as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  const content = extractAssistantContent(value);
  if (process.env.NODE_ENV !== "production") {
    console.info(`[nvidia:${label}] response-extracted`, {
      contentType: Array.isArray(raw) ? "content-parts" : typeof raw,
      characterLength: content.length,
    });
  }
  if (!content) throw new NvidiaDiagnosticError("RESPONSE_PARSE_ERROR", "NVIDIA returned no assistant content.");
  let parsed: unknown;
  try { parsed = JSON.parse(extractJsonText(content)); } catch { throw new NvidiaDiagnosticError("RESPONSE_PARSE_ERROR", "NVIDIA returned malformed JSON."); }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[nvidia:${label}] json-parsed`, {
      topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
    });
  }
  return parsed;
};

const lifeAiOutput = z.object({
  event_type: z.enum(["event", "goal", "deadline", "trip", "task", "project", "interest", "reminder"]),
  timezone: z.string().optional(),
  context: z.string().trim().min(1).max(20000),
  confidence: z.union([z.number().finite().min(0).max(1), z.string().regex(/^(?:0(?:\\.\\d+)?|1(?:\\.0+)?)$/).transform(Number)]).optional(),
});

function normalizeConfidence(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  if (typeof value === "string" && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value.trim())) return Number(value);
  return null;
}const metadata = (confidence: number | null): AIAnalysisMetadata => ({
  status: confidence === null ? "partial" : "complete",
  confidence,
  provider: "nvidia",
  model: nvidiaConfig().reasoningModel,
  warnings: [],
  evidenceSources: [],
});

export async function reason(prompt: string, operationName = "memory-analysis") {
  const { reasoningModel } = nvidiaConfig();
  return nvidiaRequest("/chat/completions", {
    model: reasoningModel,
    temperature: 0,
    max_tokens: 512,
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return JSON only. No Markdown or commentary. Use only supplied evidence. Never invent facts." },
      { role: "user", content: prompt },
    ],
  }, operationName);
}
export async function analyzeMemory(memory: Memory, evidence: SourceEvidence[]) {
  let response: unknown;
  try {
    response = await reason(JSON.stringify({
      task: "analyze memory",
      allowedActionTypes: ["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"],
      evidence,
    }));
  } catch (error) {
    logNvidiaFailure("memory-analysis", "provider-request", error);
    throw error;
  }
  try {
    const parsedJson = json(response);
    const parsed = memoryOutput.parse(parsedJson);
    return {
      memory: parsed,
      metadata: {
        ...metadata(normalizeConfidence(parsed.confidence)),
        evidenceSources: evidence,
      },
    };
  } catch (error) {
    logNvidiaFailure("memory-analysis", error instanceof z.ZodError ? "schema-validation" : error instanceof NvidiaDiagnosticError ? "json-parse" : "response-extraction", error);
    if (error instanceof NvidiaDiagnosticError) throw error;
    if (error instanceof z.ZodError) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA memory analysis output failed schema validation.");
    throw new NvidiaDiagnosticError("RESPONSE_PARSE_ERROR", "NVIDIA memory analysis output could not be parsed.");
  }
}

export async function parseLife(text: string, timezone: string) {
  let response: unknown;
  try {
    response = await reason(JSON.stringify({
      task: "parse life context",
      allowedTypes: ["event", "goal", "deadline", "trip", "task", "project", "interest", "reminder"],
      text,
      timezone,
      outputShape: "{event_type,timezone,context,confidence}",
    }), "life-parsing");
  } catch (error) {
    logNvidiaFailure("life-parsing", "provider-request", error);
    throw error;
  }
  try {
    const parsed = lifeAiOutput.parse(json(response, "life-parsing"));
    const normalized = lifeResult.parse({
      contexts: [{ type: parsed.event_type, title: parsed.context.slice(0, 300), description: parsed.context, startDate: null, endDate: null, status: "active", confidence: normalizeConfidence(parsed.confidence) }],
      metadata: { status: parsed.confidence === undefined ? "partial" : "complete", confidence: normalizeConfidence(parsed.confidence), provider: "nvidia", model: nvidiaConfig().reasoningModel, warnings: ["Date remains unresolved unless explicitly present in source text."], evidenceSources: [] },
    });
    if (process.env.NODE_ENV !== "production") console.info("[nvidia:life-parsing] schema-validated", { contextCount: normalized.contexts.length, contextTypes: normalized.contexts.map((context) => context.type) });
    return { contexts: normalized.contexts, metadata: normalized.metadata };
  } catch (error) {
    logNvidiaFailure("life-parsing", error instanceof z.ZodError ? "schema-validation" : error instanceof NvidiaDiagnosticError ? "json-parse" : "response-extraction", error);
    if (error instanceof NvidiaDiagnosticError) throw error;
    if (error instanceof z.ZodError) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA life parsing output failed schema validation.");
    throw new NvidiaDiagnosticError("RESPONSE_PARSE_ERROR", "NVIDIA life parsing output could not be parsed.");
  }
}

const actionOutput = z.object({
  type: z.enum(["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"]).optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(20000).optional(),
  payload: z.record(z.string(), z.json()).default({}),
});

const suggestedActionType = z.enum(["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"]);
const suggestedActionOutput = z.object({
  type: suggestedActionType,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(20000).optional(),
  payload: z.record(z.string(), z.json()).default({}),
});

function normalizeSuggestedAction(value: unknown): SuggestedAction | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const type = suggestedActionType.safeParse(value);
    if (!type.success) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA relevance suggested action is unsupported.");
    return { type: type.data, title: type.data.replaceAll("_", " "), payload: {} };
  }
  const parsed = suggestedActionOutput.safeParse(value);
  if (!parsed.success) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA relevance suggested action failed schema validation.");
  return parsed.data;
}

export async function generateAction(type: ActionType, memory: Memory | null, life: LifeContext | null): Promise<SuggestedAction> {
  let response: unknown;
  try { response = await reason(JSON.stringify({ task: "generate action", requestedType: type, allowedTypes: ["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"], memory, life, outputShape: "{type,title,description,payload}" }), "action-generation"); } catch (error) { logNvidiaFailure("action-generation", "provider-request", error); throw error; }
  try {
    const parsedJson = json(response, "action-generation") as Record<string, unknown>;
    const candidate = parsedJson && typeof parsedJson === "object" && parsedJson.action && typeof parsedJson.action === "object" ? parsedJson.action : parsedJson;
    const parsed = actionOutput.parse(candidate);
    if (parsed.type && parsed.type !== type) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA action type did not match the requested type.");
    return { type, title: parsed.title, description: parsed.description, payload: parsed.payload || {} };
  } catch (error) {
    logNvidiaFailure("action-generation", error instanceof z.ZodError ? "schema-validation" : error instanceof NvidiaDiagnosticError ? "json-parse" : "response-extraction", error);
    if (error instanceof NvidiaDiagnosticError) throw error;
    if (error instanceof z.ZodError) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA action output failed schema validation.");
    throw new NvidiaDiagnosticError("RESPONSE_PARSE_ERROR", "NVIDIA action output could not be parsed.");
  }
}

export async function evaluateRelevance(memory: Memory, life: LifeContext, similarity: number) {
  let response: unknown;
  try { response = await reason(JSON.stringify({ task: "evaluate relevance", memory, life, similarity, outputShape: "{relevant,confidence,reason,suggestedAction}", allowedActionTypes: ["shopping_list", "revision_plan", "itinerary", "checklist", "reminder"] }), "context-relevance"); } catch (error) { logNvidiaFailure("context-relevance", "provider-request", error); throw error; }
  let parsed: Record<string, unknown>;
  try { parsed = json(response, "context-relevance") as Record<string, unknown>; } catch (error) { logNvidiaFailure("context-relevance", error instanceof NvidiaDiagnosticError ? "json-parse" : "response-extraction", error); throw error; }
  if (process.env.NODE_ENV !== "production") console.info("[nvidia:context-relevance] shape", { topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [], fieldTypes: parsed && typeof parsed === "object" ? Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, typeof value])) : {}, confidenceType: typeof parsed?.confidence, suggestedActionType: typeof parsed?.suggestedAction });
  const candidate = parsed.result && typeof parsed.result === "object" ? parsed.result as Record<string, unknown> : parsed;
  if (candidate && typeof candidate === "object" && "suggested_action" in candidate && !("suggestedAction" in candidate)) candidate.suggestedAction = candidate.suggested_action;
  try {
    const confidence = normalizeConfidence(candidate.confidence);
    if (typeof candidate.relevant !== "boolean" || confidence === null || !String(candidate.reason || "").trim()) throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA relevance output failed schema validation.");
    const suggestedAction = normalizeSuggestedAction(candidate.suggestedAction);
    if (!candidate.relevant || confidence < 0.25) return { relevant: false, confidence, reason: String(candidate.reason || ""), suggestedAction };
    return { relevant: true, confidence, reason: String(candidate.reason), suggestedAction };
  } catch (error) {
    logNvidiaFailure("context-relevance", "schema-validation", error);
    if (error instanceof NvidiaDiagnosticError) throw error;
    throw new NvidiaDiagnosticError("SCHEMA_VALIDATION_ERROR", "NVIDIA relevance output failed schema validation.");
  }
}
