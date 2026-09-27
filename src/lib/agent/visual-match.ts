import type { Memory } from "@/types/reibry";

/** Requires evidence that the requested design belongs to the cake, not merely appears nearby. */
export function exactCakeVisualEvidence(memory: Memory, attribute: string) {
  const needle = attribute.toLowerCase().trim();
  const titleSummary = `${memory.title} ${memory.summary || ""} ${memory.rawText || ""} ${memory.tags.join(" ")} ${memory.entities.map((entity) => entity.name).join(" ")}`.toLowerCase();
  const concepts = memory.analysisMetadata?.semanticConcepts || [];
  const visual = memory.analysisMetadata?.visualEvidence;
  const visualText = [visual?.visualDescription || "", ...(visual?.relationships || [])].join(" ").toLowerCase();
  const allEvidence = `${titleSummary} ${visualText}`;
  if (!needle || !/\bcake\b/.test(allEvidence) || !needle.split(/\s+/).every((part) => allEvidence.includes(part))) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directPhrase = new RegExp(`(?:${escaped})[- ]+(?:(?:shaped|themed|decorated|design)[- ]+)?cake|cake[- ]+(?:with|has|featuring)[- ]+(?:a[- ]+)?${escaped}`, "i");
  const describedRelationship = new RegExp(`cake.{0,50}(?:shaped|designed|decorated|themed|resembl|look(?:s|ed)? like).{0,45}${escaped}|${escaped}.{0,45}(?:shaped|designed|decorated|themed|resembl).{0,45}cake`, "i");
  const sourceTextDirect = directPhrase.test(titleSummary) || describedRelationship.test(titleSummary);
  const conceptDirect = concepts.some((item) => item.source === "thumbnail" && item.strength !== "related" && /cake/i.test(item.concept) && item.concept.toLowerCase().includes(needle));
  const visualDirect = visual?.analyzed && (directPhrase.test(visualText) || describedRelationship.test(visualText));
  return Boolean(sourceTextDirect || conceptDirect || visualDirect);
}

export function boundedVisualCandidates<T>(items: T[], maximum = 3) {
  return items.slice(0, Math.max(0, Math.min(3, maximum)));
}
