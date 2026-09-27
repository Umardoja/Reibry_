import { NextResponse } from "next/server";
import { z } from "zod";
import { verifiedStore } from "@/lib/integration/orchestrator";
import { gapSections, matchPackMemories, packTypeFor } from "@/lib/plans/service";
import { controlledPackSections, reconcilePackItems } from "@/lib/plans/finalization";
import type { ReadyPack, ReadyPackItem, ReadyPackType } from "@/types/reibry";

const finalizeSchema = z.object({
  lifeContextId: z.uuid(),
  selections: z.record(z.string(), z.array(z.uuid()).max(20)).optional(),
  // Kept temporarily for older clients; it is still validated against current grounded candidates.
  selectedMemoryIds: z.array(z.uuid()).max(20).optional(),
}).strict().refine((value) => value.selections !== undefined || (value.selectedMemoryIds?.length || 0) > 0);

function response(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
function error(message: string, status: number, code = "VALIDATION_ERROR") {
  return NextResponse.json({ data: null, error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
function sectionsFor(type: ReadyPackType) {
  return type === "travel" ? ["Places", "Food", "Stay", "Travel tips"] : type === "event" ? ["Cake ideas", "Gift ideas", "Places to go", "Activities"] : ["Tutorials", "Topics", "Practice", "Resources"];
}

export async function GET() {
  try {
    const { store } = await verifiedStore();
    const [packs, items, contexts] = await Promise.all([store.list("ready_packs"), store.list("ready_pack_items"), store.list("life_contexts")]);
    const unique = new Map<string, typeof packs[number]>();
    for (const pack of packs.filter((item) => item.status === "active").sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))) if (!unique.has(pack.lifeContextId)) unique.set(pack.lifeContextId, pack);
    const visible = [...unique.values(), ...packs.filter((pack) => pack.status !== "active")];
    return response(visible.map((pack) => {
      const siblingIds = pack.status === "active" ? new Set(packs.filter((item) => item.status === "active" && item.lifeContextId === pack.lifeContextId).map((item) => item.id)) : new Set([pack.id]);
      const merged = new Map<string, typeof items[number]>();
      for (const item of items.filter((candidate) => siblingIds.has(candidate.readyPackId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) if (!merged.has(item.memoryId)) merged.set(item.memoryId, { ...item, readyPackId: pack.id });
      const packItems = [...merged.values()];
      return { ...pack, context: contexts.find((context) => context.id === pack.lifeContextId) || null, items: packItems, memoryCount: packItems.length, missing: gapSections(pack.packType, packItems) };
    }));
  } catch { return error("Sign in to view your plans.", 401, "AUTH_REQUIRED"); }
}

export async function POST(request: Request) {
  const touchedRows: ReadyPackItem[] = [];
  let deletedRows: ReadyPackItem[] = [];
  try {
    const parsed = finalizeSchema.parse(await request.json());
    const { store } = await verifiedStore();
    const context = await store.get("life_contexts", parsed.lifeContextId);
    if (context.status !== "active") return error("This plan is no longer active.", 409);
    const type = packTypeFor(context);
    if (!type) return error("This Life context is not ready for a pack yet.", 400);
    const sections = sectionsFor(type);
    if (parsed.selections && Object.keys(parsed.selections).some((section) => !sections.includes(section))) return error("One or more sections do not belong to this Ready Pack.", 400);
    const controlledSections = parsed.selections ? controlledPackSections(Object.keys(parsed.selections)) : [];
    const selectedIds = parsed.selections
      ? sections.flatMap((section) => (parsed.selections?.[section] || []).map((id) => ({ id, section })))
      : (parsed.selectedMemoryIds || []).map((id) => ({ id, section: "" }));
    const uniqueIds = new Set(selectedIds.map((entry) => entry.id));
    if (uniqueIds.size !== selectedIds.length) return error("Choose each Memory only once.", 400);
    let allowed = new Map<string, Awaited<ReturnType<typeof matchPackMemories>>[number]>();
    if (parsed.selections) {
      // Revalidate only explicitly selected user-owned items; avoid repeating broad candidate retrieval.
      const selectedMemories = await store.getMemories([...uniqueIds]);
      allowed = new Map((await matchPackMemories(context, selectedMemories, type)).map((match) => [match.memory.id, match]));
    } else {
      // Compatibility for older clients that sent IDs without section names.
      const searches = type === "travel" ? [context.title, context.description || ""] : type === "learning" ? [context.title, context.description || ""] : ["cake", "gift idea", "birthday restaurant", "birthday activity"];
      const pages = await Promise.all([store.listMemories({ limit: type === "event" ? 40 : 20 }), ...searches.filter(Boolean).map((search) => store.listMemories({ limit: 20, search }))]);
      const memories = [...new Map(pages.flatMap((page) => page.items).map((memory) => [memory.id, memory])).values()];
      allowed = new Map((await matchPackMemories(context, memories, type)).map((match) => [match.memory.id, match]));
      controlledSections.push(...new Set(selectedIds.map((item) => allowed.get(item.id)?.section || "").filter(Boolean)));
    }
    const selected = selectedIds.map(({ id, section }) => {
      const match = allowed.get(id);
      if (!match || match.section !== section) return null;
      return match;
    });
    if (selected.some((item) => item === null)) return error("Choose from the relevant Memories shown for this plan.", 400);
    if (selected.length === 0 && !parsed.selections) return error("Choose at least one Memory or handle each section before saving.", 400);

    const existingPacks = (await store.list("ready_packs")).filter((item) => item.lifeContextId === context.id && item.status === "active").sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    let pack: ReadyPack | undefined = existingPacks[0];
    let createdPack = false;
    if (!pack) {
      try { pack = await store.insert("ready_packs", { lifeContextId: context.id, title: context.title, packType: type, status: "active" }); createdPack = true; }
      catch (cause) { pack = (await store.list("ready_packs")).find((item) => item.lifeContextId === context.id && item.status === "active"); if (!pack) throw cause; }
    }
    if (!pack) throw new Error("Ready Pack could not be created.");
    const canonicalPack = pack;
    const siblings = existingPacks.length ? existingPacks : [canonicalPack];
    const siblingIds = new Set(siblings.map((item) => item.id));
    const currentItems = (await store.list("ready_pack_items")).filter((candidate) => siblingIds.has(candidate.readyPackId));
    const selectedItems = (selected as NonNullable<(typeof selected)[number]>[]).map((match) => ({ readyPackId: canonicalPack.id, memoryId: match.memory.id, section: match.section, relevanceReason: match.relevanceReason, relevanceStrength: match.relevanceStrength }));
    const desiredItems = reconcilePackItems(currentItems, selectedItems, controlledSections);
    const desiredOldIds = new Set(desiredItems.flatMap((item) => "id" in item ? [item.id] : []));
    deletedRows = currentItems.filter((item) => !desiredOldIds.has(item.id));
    try {
      for (const item of deletedRows) await store.delete("ready_pack_items", item.id);
      const existingMemoryIds = new Set(currentItems.filter((item) => desiredOldIds.has(item.id)).map((item) => item.memoryId));
      for (const item of selectedItems) {
        if (existingMemoryIds.has(item.memoryId)) continue;
        const saved = await store.insert("ready_pack_items", { readyPackId: canonicalPack.id, memoryId: item.memoryId, section: item.section, relevanceReason: item.relevanceReason, relevanceStrength: item.relevanceStrength });
        touchedRows.push(saved);
      }
    } catch (cause) {
      for (const item of touchedRows) await store.delete("ready_pack_items", item.id).catch(() => undefined);
      for (const item of deletedRows) await store.insert("ready_pack_items", { readyPackId: item.readyPackId, memoryId: item.memoryId, section: item.section, relevanceReason: item.relevanceReason, relevanceStrength: item.relevanceStrength }).catch(() => undefined);
      if (createdPack) await store.delete("ready_packs", canonicalPack.id).catch(() => undefined);
      throw cause;
    }
    const canonicalByMemory = new Map<string, ReadyPackItem>();
    for (const item of (await store.list("ready_pack_items")).filter((candidate) => siblingIds.has(candidate.readyPackId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) if (!canonicalByMemory.has(item.memoryId)) canonicalByMemory.set(item.memoryId, item);
    const canonicalItems = [...canonicalByMemory.values()];
    const savedMemories = await store.getMemories(canonicalItems.map((item) => item.memoryId));
    return response({ pack: canonicalPack, items: canonicalItems, memories: savedMemories, memoryCount: canonicalItems.length, missingSections: gapSections(type, canonicalItems), missing: gapSections(type, canonicalItems) });
  } catch (cause) {
    const status = cause instanceof z.ZodError ? 400 : 500;
    return error(status === 400 ? "Check the Ready Pack selections and try again." : "The Ready Pack could not be saved. Your previous saved choices were preserved where possible.", status, status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR");
  }
}
