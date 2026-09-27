import { IntegrationError } from "../../integration/errors.ts";

export type NvidiaErrorCategory = "TIMEOUT" | "NETWORK_ERROR" | "RATE_LIMITED" | "AUTH_ERROR" | "HTTP_ERROR" | "RESPONSE_PARSE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "INVALID_EMBEDDING" | "UNKNOWN_ERROR";

export class NvidiaDiagnosticError extends IntegrationError {
  readonly category: NvidiaErrorCategory;

  constructor(category: NvidiaErrorCategory, message: string, code: "AI_UNAVAILABLE" | "RATE_LIMITED" = "AI_UNAVAILABLE") {
    super(code, message);
    this.name = "NvidiaDiagnosticError";
    this.category = category;
  }
}

export function nvidiaErrorCategory(error: unknown): NvidiaErrorCategory {
  if (error instanceof NvidiaDiagnosticError) return error.category;
  if (error && typeof error === "object" && "category" in error && typeof error.category === "string" && ["TIMEOUT", "NETWORK_ERROR", "RATE_LIMITED", "AUTH_ERROR", "HTTP_ERROR", "RESPONSE_PARSE_ERROR", "SCHEMA_VALIDATION_ERROR", "INVALID_EMBEDDING", "UNKNOWN_ERROR"].includes(error.category)) return error.category as NvidiaErrorCategory;
  if (error instanceof Error && error.name === "ZodError") return "SCHEMA_VALIDATION_ERROR";
  if (error instanceof IntegrationError) return error.code === "RATE_LIMITED" ? "RATE_LIMITED" : "HTTP_ERROR";
  return "UNKNOWN_ERROR";
}

export function logNvidiaFailure(operation: string, stage: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") console.error(`[nvidia:${operation}] failed`, { stage, errorType: nvidiaErrorCategory(error), errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : "Unknown error" });
}

export function transportDiagnostics(error: unknown) {
  const value = error && typeof error === "object" ? error as { name?: unknown; message?: unknown; cause?: { name?: unknown; code?: unknown; message?: unknown } } : {};
  return {
    transportErrorName: typeof value.name === "string" ? value.name : undefined,
    transportErrorCode: typeof value.cause?.code === "string" ? value.cause.code : undefined,
    transportCauseName: typeof value.cause?.name === "string" ? value.cause.name : undefined,
  };
}

export function transportErrorCode(error: unknown): string | undefined {
  if (error instanceof NvidiaDiagnosticError) return undefined;
  const value = error && typeof error === "object" ? error as { code?: unknown; cause?: { code?: unknown } } : {};
  return typeof value.cause?.code === "string" ? value.cause.code : typeof value.code === "string" ? value.code : undefined;
}

export function isTransientNetworkError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const code = transportErrorCode(error) || "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (name === "AbortError") return false;
  if (/^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code)) return true;
  return /socket|connect|connection reset|connection refused|dns|fetch failed|network/.test(message);
}