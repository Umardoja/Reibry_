import type { AIAnalysisMetadata } from "@/types/reibry";

type VisualResult = { description: string; primaryObjects: string[]; visualConcepts: string[]; attributes: string[]; relationships: string[]; activities: string[]; visibleText: string[]; confidence: "high" | "medium" | "low" };
const clean = (values: string[], max: number, maxLength = 120) => [...new Set(values.map((item) => item.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, max).map((item) => item.slice(0, maxLength));

/** Convert provider observations into a bounded, provenance-preserving retrieval index. */
export function mergeThumbnailEvidence(metadata: AIAnalysisMetadata, result: VisualResult): AIAnalysisMetadata {
  const primaryObjects = clean(result.primaryObjects, 8, 80);
  const relationships = clean(result.relationships, 12);
  const attributes = clean(result.attributes, 12, 80);
  const concepts = clean([...result.visualConcepts, ...relationships], 16, 80);
  const existing = (metadata.semanticConcepts || []).filter((entry) => entry.source !== "thumbnail");
  const known = new Set(existing.map((entry) => entry.concept.toLowerCase()));
  const visualEntries = concepts.filter((concept) => !known.has(concept.toLowerCase())).map((concept) => ({ concept, source: "thumbnail", strength: "direct" as const }));
  return {
    ...metadata,
    visualEvidence: { source: "thumbnail", analyzed: true, concepts, primaryObjects, attributes, relationships, confidence: result.confidence, visualDescription: result.description.slice(0, 1000) },
    semanticConcepts: [...existing, ...visualEntries].slice(0, 64),
  };
}

export function visualRelationshipSupports(memory: { analysisMetadata?: AIAnalysisMetadata }, object: string, design: string) {
  const visual = memory.analysisMetadata?.visualEvidence;
  if (!visual?.analyzed) return false;
  const evidence = [...(visual.relationships || []), ...visual.concepts].join(" ").toLowerCase();
  return evidence.includes(object.toLowerCase()) && evidence.includes(design.toLowerCase()) && /shape|resembl|design|like|themed|form|made as/.test(evidence);
}
