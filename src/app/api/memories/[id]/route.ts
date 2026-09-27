import { NextResponse } from "next/server";
import { verifiedStore } from "@/lib/integration/orchestrator";
import { IntegrationError } from "@/lib/integration/errors";
import { getMemoryById } from "@/lib/data/memory-detail";
import { z } from "zod";
import { MEMORY_CATEGORIES } from "@/lib/sources/enrichment";

const editMemory = z.strictObject({
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(20000).nullable(),
  category: z.enum(MEMORY_CATEGORIES),
  tags: z.array(z.string().trim().min(1).max(300)).max(20),
});

function failure(error: unknown) {
  const code = error instanceof IntegrationError ? error.code : error instanceof z.ZodError ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
  const status = code === "AUTH_REQUIRED" ? 401 : code === "NOT_FOUND" ? 404 : code === "VALIDATION_ERROR" ? 400 : 500;
  return NextResponse.json({ data: null, error: { code, message: code === "AUTH_REQUIRED" ? "Sign in to manage memories." : code === "NOT_FOUND" ? "Memory not found." : code === "VALIDATION_ERROR" ? "Check the Memory details and try again." : "Unable to update memory." } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { store } = await verifiedStore();
    const memory = await getMemoryById(store, id);
    return NextResponse.json({ data: memory, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof IntegrationError ? error.code : "INTERNAL_ERROR";
    const status = code === "AUTH_REQUIRED" ? 401 : code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ data: null, error: { code, message: code === "AUTH_REQUIRED" ? "Sign in to view memories." : code === "NOT_FOUND" ? "Memory not found." : "Unable to load memory." } }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = editMemory.parse(await request.json());
    const { store } = await verifiedStore();
    const memory = await store.update("memories", id, { ...input, tags: [...new Set(input.tags.map((tag) => tag.toLowerCase()))] });
    return NextResponse.json({ data: memory, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { store } = await verifiedStore();
    await store.delete("memories", id);
    return NextResponse.json({ data: { id }, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
