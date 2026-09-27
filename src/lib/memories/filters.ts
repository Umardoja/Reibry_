import { MEMORY_CATEGORIES } from "../sources/categories.ts";
import type { MemoryListOptions } from "../data/store.ts";

export type MemorySourceFilter = "tiktok" | "youtube" | "web" | "text";
export type MemoryDatePreset = "all" | "today" | "week" | "month" | "choose-month" | "custom";

export function memoryDateRange(input: { preset: MemoryDatePreset; month?: string; customFrom?: string; customTo?: string; referenceNow?: Date }) {
  const now = input.referenceNow || new Date();
  let from: Date | null = null;
  let to: Date | null = null;
  if (input.preset === "today") { from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); }
  if (input.preset === "week") { const offset = (now.getDay() + 6) % 7; from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset); to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7); }
  if (input.preset === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
  if (input.preset === "choose-month" && /^\d{4}-\d{2}$/.test(input.month || "")) { const [year, month] = input.month!.split("-").map(Number); from = new Date(year, month - 1, 1); to = new Date(year, month, 1); }
  if (input.preset === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(input.customFrom || "")) from = new Date(`${input.customFrom}T00:00:00`);
  if (input.preset === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(input.customTo || "")) { const end = new Date(`${input.customTo}T00:00:00`); to = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1); }
  return { from: from && Number.isFinite(from.getTime()) ? from.toISOString() : undefined, to: to && Number.isFinite(to.getTime()) ? to.toISOString() : undefined };
}

function isoBoundary(value: string | null) {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

export function parseMemoryListQuery(params: URLSearchParams): { options?: MemoryListOptions; error?: string } {
  const requestedLimit = Number.parseInt(params.get("limit") || "20", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
  const category = params.get("category") || undefined;
  const validCategory = !category || category === "All" || (MEMORY_CATEGORIES as readonly string[]).includes(category) ? category : undefined;
  const sourceValue = params.get("source");
  const source = (["tiktok", "youtube", "web", "text"] as const).find((value) => value === sourceValue);
  const from = isoBoundary(params.get("from"));
  const to = isoBoundary(params.get("to"));
  if ((params.has("from") && !from) || (params.has("to") && !to) || (from && to && from >= to)) return { error: "Choose a valid date range." };
  return { options: { limit, cursor: params.get("cursor") || undefined, search: params.get("search") || undefined, category: validCategory, source, from, to } };
}
