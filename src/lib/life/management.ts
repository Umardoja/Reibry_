import type { LifeContext } from "@/types/reibry";

export function normalizeLifeText(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
export function partitionLifeContexts(items: LifeContext[], now = new Date()) {
  const upcoming: LifeContext[] = [], undated: LifeContext[] = [], past: LifeContext[] = [];
  for (const item of items) {
    if (!item.startDate) { undated.push(item); continue; }
    const date = new Date(item.startDate);
    if (item.status !== "active" || Number.isNaN(date.getTime()) || date < now) past.push(item); else upcoming.push(item);
  }
  upcoming.sort((a, b) => Date.parse(a.startDate || "") - Date.parse(b.startDate || ""));
  past.sort((a, b) => Date.parse(b.startDate || "") - Date.parse(a.startDate || ""));
  return { upcoming, undated, past };
}
export function isDuplicateLifeContext(existing: LifeContext, candidate: Pick<LifeContext, "title" | "description" | "startDate">) {
  const left = normalizeLifeText(existing.title || existing.description || "");
  const right = normalizeLifeText(candidate.title || candidate.description || "");
  if (!left || !right || !existing.startDate || !candidate.startDate) return false;
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2 && !["the", "next", "this", "going", "trip", "event"].includes(token)));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2 && !["the", "next", "this", "going", "trip", "event"].includes(token)));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  if (left !== right && overlap === 0) return false;
  return Math.abs(Date.parse(existing.startDate) - Date.parse(candidate.startDate)) <= (left === right ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000);
}
