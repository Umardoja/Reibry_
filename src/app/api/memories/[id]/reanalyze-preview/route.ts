import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationError } from "@/lib/integration/errors";
import { reanalyzeMemoryPreview } from "@/lib/integration/orchestrator";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const memoryId = z.string().uuid().parse(id);
    const memory = await reanalyzeMemoryPreview(memoryId);
    return NextResponse.json({ data: memory, error: null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof IntegrationError ? error.code === "AUTH_REQUIRED" ? 401 : error.code === "NOT_FOUND" ? 404 : error.code === "VALIDATION_ERROR" ? 422 : 503 : 500;
    const message = error instanceof IntegrationError ? error.message : status === 400 ? "Invalid Memory identifier." : "Unable to re-analyze this preview.";
    return NextResponse.json({ data: null, error: { code: status === 503 ? "AI_UNAVAILABLE" : status === 422 ? "VALIDATION_ERROR" : status === 404 ? "NOT_FOUND" : status === 401 ? "AUTH_REQUIRED" : "INTERNAL_ERROR", message } }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
