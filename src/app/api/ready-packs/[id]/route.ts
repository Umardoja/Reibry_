import { NextResponse } from "next/server";
import { verifiedStore } from "@/lib/integration/orchestrator";
import { gapSections } from "@/lib/plans/service";
import type { ReadyPackItem } from "@/types/reibry";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const { store } = await verifiedStore(); const pack = await store.get("ready_packs", id); const siblings = pack.status === "active" ? (await store.list("ready_packs")).filter((candidate) => candidate.status === "active" && candidate.lifeContextId === pack.lifeContextId) : [pack]; const siblingIds = new Set(siblings.map((candidate) => candidate.id)); const merged = new Map<string, ReadyPackItem>(); for (const item of await store.list("ready_pack_items")) if (siblingIds.has(item.readyPackId) && !merged.has(item.memoryId)) merged.set(item.memoryId, { ...item, readyPackId: pack.id }); const items = [...merged.values()]; const memories = await store.getMemories(items.map((item) => item.memoryId)); const context = await store.get("life_contexts", pack.lifeContextId); return NextResponse.json({ data: { ...pack, context, items, memories, memoryCount: items.length, missing: gapSections(pack.packType, items) }, error: null }, { headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
  catch { return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Plan not found." } }, { status: 404 }); }
}
