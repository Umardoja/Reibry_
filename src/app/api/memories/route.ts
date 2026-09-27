import { NextResponse } from "next/server";
import { verifiedStore } from "@/lib/integration/orchestrator";
import { parseMemoryListQuery } from "@/lib/memories/filters";

export async function GET(request: Request) {
  try {
    const { store } = await verifiedStore();
    const url = new URL(request.url);
    const parsed = parseMemoryListQuery(url.searchParams);
    if (!parsed.options) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: parsed.error || "Choose valid filters." } }, { status: 400 });
    const page = await store.listMemories(parsed.options);
    return NextResponse.json({ data: { items: page.items, nextCursor: page.nextCursor, hasMore: Boolean(page.nextCursor) }, error: null });
  } catch (error) {
    const status = error instanceof Error && "code" in error && (error as { code?: string }).code === "AUTH_REQUIRED" ? 401 : 500;
    return NextResponse.json({ data: null, error: { code: status === 401 ? "AUTH_REQUIRED" : "INTERNAL_ERROR", message: status === 401 ? "Sign in to view memories." : "Unable to load memories." } }, { status });
  }
}
