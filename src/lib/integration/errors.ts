export const errorStatuses = { VALIDATION_ERROR: 400, AUTH_REQUIRED: 401, NOT_FOUND: 404, SOURCE_UNAVAILABLE: 422, AI_UNAVAILABLE: 503, LOW_CONFIDENCE: 422, RATE_LIMITED: 429, INTERNAL_ERROR: 500 } as const;
export class IntegrationError extends Error {
  code: keyof typeof errorStatuses;
  constructor(code: keyof typeof errorStatuses, message: string) { super(message); this.code = code; }
}
export function publicErrorMessage(code: keyof typeof errorStatuses): string {
  switch (code) {
    case "AUTH_REQUIRED": return "Authentication failed. Check your details and try again.";
    case "NOT_FOUND": return "The requested item was not found.";
    case "SOURCE_UNAVAILABLE": return "That source is temporarily unavailable.";
    case "AI_UNAVAILABLE": return "REIBRY is temporarily unable to analyze this. Please try again.";
    case "LOW_CONFIDENCE": return "REIBRY needs more information to make that connection.";
    case "RATE_LIMITED": return "REIBRY is busy right now. Please try again shortly.";
    case "VALIDATION_ERROR": return "Check the submitted information and try again.";
    default: return "The request could not be completed.";
  }
}
export function errorResponse(error: unknown) {
  const known = error instanceof IntegrationError;
  const code = known ? error.code : "INTERNAL_ERROR";
  return { status: errorStatuses[code], body: { data: null, error: { code, message: publicErrorMessage(code) } } };
}
