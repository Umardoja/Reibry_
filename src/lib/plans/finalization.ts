import type { ReadyPackItem } from "../../types/reibry.ts";

export type PackSectionChoice = { id: string; section: string };
export type SectionSelections = Record<string, string[]>;

export function expectedPackSections(type: "travel" | "event" | "learning") {
  return type === "travel" ? ["Places", "Food", "Stay", "Travel tips"] : type === "event" ? ["Cake ideas", "Gift ideas", "Places to go", "Activities"] : ["Tutorials", "Topics", "Practice", "Resources"];
}

/** Keep each guide's next useful actions predictable, with manual sections preserved afterward. */
export function readyPackStepOrder(type: "travel" | "event" | "learning", sections: string[]) {
  const preferred = expectedPackSections(type);
  return [...preferred.filter((section) => sections.includes(section)), ...sections.filter((section) => !preferred.includes(section))];
}

/** Reconcile only sections the user explicitly handled. Unknown/manual sections survive. */
export function reconcilePackItems<T extends Pick<ReadyPackItem, "id" | "section" | "memoryId">, R extends Pick<ReadyPackItem, "section" | "memoryId">>(existing: T[], replacements: R[], controlledSections: string[]) {
  const controlled = new Set(controlledSections);
  const replacementIds = new Set(replacements.map((item) => item.memoryId));
  const retained: Array<T | R> = existing.filter((item) => !controlled.has(item.section) && !replacementIds.has(item.memoryId));
  const seen = new Set(retained.map((item) => item.memoryId));
  for (const item of replacements) {
    if (!controlled.has(item.section) || seen.has(item.memoryId)) continue;
    retained.push(item);
    seen.add(item.memoryId);
  }
  return retained;
}

export function packSections(type: "travel" | "event" | "learning", candidates: PackSectionChoice[]) {
  const ordered = expectedPackSections(type);
  const available = new Set(candidates.map((candidate) => candidate.section));
  return ordered.filter((section) => available.has(section));
}

export function selectSectionMemory(selections: SectionSelections, section: string, memoryId: string): SectionSelections {
  return { ...selections, [section]: [memoryId] };
}

export function selectedPackMemoryIds(selections: SectionSelections) {
  return [...new Set(Object.values(selections).flat())];
}

/** Names written by the earlier automatic builder for the same user-facing role. */
export function controlledPackSections(sections: string[]) {
  const aliases: Record<string, string[]> = {
    "Cake ideas": ["Cake ideas", "Cake / food ideas"],
  };
  return [...new Set(sections.flatMap((section) => aliases[section] || [section]))];
}
