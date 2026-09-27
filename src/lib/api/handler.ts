import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { IntegrationError, publicErrorMessage } from "../integration/errors";
import { ConfigurationError, NotImplementedError } from "@/lib/utils/errors";
import type { ApiResponse } from "./contracts";

function failure(status: number, code: string, message: string, details?: { path: string; message: string }[]) {
  return NextResponse.json<ApiResponse<never>>({ data: null, error: { code, message, ...(details ? { details } : {}) } }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}

export function createPostHandler<S extends z.ZodType, T>(schema: S, execute: (input: z.output<S>, userId: string) => Promise<T>, authorize?: () => Promise<string>) {
  return async (request: Request) => {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
    }
    let body: unknown;
    try { body = await request.json(); } catch { return failure(400, "INVALID_JSON", "Body must be valid JSON."); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return failure(400, "VALIDATION_ERROR", "Request validation failed.", parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
    try {
      let userId: string;
      if (authorize) userId = await authorize();
      else {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error || !data?.claims.sub) return failure(401, "UNAUTHENTICATED", "Sign in to use this endpoint.");
      userId = data.claims.sub;
      }
      const result = await execute(parsed.data, userId);
      return NextResponse.json<ApiResponse<T>>({ data: result, error: null }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof ConfigurationError) return failure(503, "CONFIGURATION_ERROR", "REIBRY is not configured for this operation.");
      if (error instanceof NotImplementedError) return failure(501, "NOT_IMPLEMENTED", "This operation is not available yet.");
      if (error instanceof IntegrationError) {
        const status = error.code === "AUTH_REQUIRED" ? 401 : error.code === "NOT_FOUND" ? 404 : error.code === "AI_UNAVAILABLE" ? 503 : error.code === "SOURCE_UNAVAILABLE" ? 422 : error.code === "LOW_CONFIDENCE" ? 422 : error.code === "RATE_LIMITED" ? 429 : error.code === "VALIDATION_ERROR" ? 400 : 500;
        return failure(status, error.code, publicErrorMessage(error.code));
      }
      return failure(500, "INTERNAL_ERROR", "The request could not be completed.");
    }
  };
}
