import { createHash } from "node:crypto";
import { IntegrationError } from "../../integration/errors.ts";
import { NVIDIA_BASE_URL, nvidiaConfig } from "./config.ts";
import { NvidiaDiagnosticError, isTransientNetworkError, nvidiaErrorCategory, transportDiagnostics, transportErrorCode } from "./errors.ts";

const transientStatuses = new Set([429, 500, 502, 503, 504]);
const retryDelayMs = 500;

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function nvidiaRequest(path: string, body: unknown, operationName = path) {
  const { apiKey, requestTimeoutMs, reasoningModel, embeddingModel } = nvidiaConfig();
  const timeout = Number(process.env.NVIDIA_STRUCTURED_TIMEOUT_MS || requestTimeoutMs);
  const maxAttempts = 2;
  const requestBody = JSON.stringify(body);
  const messages = (body as { messages?: { role?: string; content?: unknown }[] })?.messages ?? [];
  const fingerprint = createHash("sha256").update(requestBody).digest("hex").slice(0, 16);
  const model = path.includes("embedding") ? embeddingModel : (body as { model?: string }).model || reasoningModel;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    if (process.env.NODE_ENV !== "production") console.info("[nvidia] request", { operation: operationName, attempt, maxAttempts, model, messageCount: messages.length, systemPromptChars: typeof messages.find((m) => m.role === "system")?.content === "string" ? (messages.find((m) => m.role === "system")?.content as string).length : 0, userPromptChars: typeof messages.find((m) => m.role === "user")?.content === "string" ? (messages.find((m) => m.role === "user")?.content as string).length : 0, requestChars: requestBody.length, fingerprint, maxTokens: (body as { max_tokens?: number }).max_tokens, temperature: (body as { temperature?: number }).temperature, topP: (body as { top_p?: number }).top_p, topK: (body as { top_k?: number }).top_k, enableThinking: (body as { chat_template_kwargs?: { enable_thinking?: boolean } }).chat_template_kwargs?.enable_thinking, requestTimeoutMs: timeout });
    try {
      const response = await fetch(`${NVIDIA_BASE_URL}${path}`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: requestBody, signal: controller.signal });
      const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
      const latencyMs = Date.now() - started;
      if (process.env.NODE_ENV !== "production") console.info("[nvidia] response", { operation: operationName, attempt, maxAttempts, model, httpStatus: response.status, latencyMs, timeout: false, requestId });
      if (!response.ok) {
        const retryable = transientStatuses.has(response.status);
        if (retryable && attempt < maxAttempts) { await delay(retryDelayMs); continue; }
        if (response.status === 429) throw new NvidiaDiagnosticError("RATE_LIMITED", "NVIDIA rate limit reached.", "RATE_LIMITED");
        if (response.status === 401 || response.status === 403) throw new NvidiaDiagnosticError("AUTH_ERROR", "NVIDIA authentication failed.");
        throw new NvidiaDiagnosticError("HTTP_ERROR", `NVIDIA request failed (${response.status}).`);
      }
      return await response.json() as unknown;
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      const networkError = !timedOut && !(error instanceof IntegrationError) && isTransientNetworkError(error);
      const retryable = timedOut || networkError || error instanceof IntegrationError && error.code === "RATE_LIMITED";
      if (process.env.NODE_ENV !== "production") console.error("[nvidia] failure", { operation: operationName, attempt, maxAttempts, model, latencyMs: Date.now() - started, timeout: timedOut, fallbackUsed: false, errorType: timedOut ? "TIMEOUT" : networkError ? "NETWORK_ERROR" : nvidiaErrorCategory(error), safeError: networkError ? "NVIDIA transport failure" : error instanceof Error ? error.message : "Unknown error", ...(networkError ? transportDiagnostics(error) : {}) });
      if (retryable && attempt < maxAttempts) { await delay(retryDelayMs); continue; }
      if (error instanceof IntegrationError) throw error;
      throw new NvidiaDiagnosticError(timedOut ? "TIMEOUT" : networkError ? "NETWORK_ERROR" : "HTTP_ERROR", timedOut ? "NVIDIA request timed out." : networkError ? `NVIDIA network request failed${transportErrorCode(error) ? ` (${transportErrorCode(error)})` : ""}.` : "NVIDIA request was unavailable.");
    } finally { clearTimeout(timer); }
  }
  throw new IntegrationError("AI_UNAVAILABLE", "NVIDIA request was unavailable.");
}