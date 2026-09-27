import type { Memory, SourceEvidence } from "../../types/reibry.ts";

/** Keep only bounded fields needed to render/reason about a Home choice in this tab session. */
export function compactSessionMemory(memory: Memory): Memory {
  const compactStrings = (value: unknown, limit: number, length: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, limit).map((item) => item.slice(0, length)) : [];
  const compactEvidence = (items: SourceEvidence[] | undefined): SourceEvidence[] => (Array.isArray(items) ? items : []).slice(0, 4).filter((source): source is SourceEvidence => Boolean(source && typeof source === "object")).map((source) => ({
    modality: source.modality,
    mimeType: source.mimeType,
    title: source.title?.slice(0, 240),
    thumbnail: source.thumbnail?.slice(0, 2048),
    platform: source.platform?.slice(0, 80),
    metadataSource: source.metadataSource?.slice(0, 80),
  }));
  const evidenceSources = compactEvidence(memory.evidenceSources);
  const metadata = memory.analysisMetadata;
  const ingredients = metadata?.structuredContent?.ingredients;
  const steps = metadata?.structuredContent?.steps;
  return {
    ...memory,
    title: memory.title.slice(0, 240),
    summary: memory.summary?.slice(0, 900) || null,
    tags: memory.tags.slice(0, 12).map((tag) => tag.slice(0, 80)),
    entities: memory.entities.slice(0, 12).map((entity) => ({ name: entity.name.slice(0, 120), type: entity.type.slice(0, 80) })),
    sourceUrl: memory.sourceUrl?.slice(0, 2048) || null,
    rawText: null,
    possibleIntents: memory.possibleIntents.slice(0, 12).map((intent) => intent.slice(0, 100)),
    possibleActions: [],
    evidenceSources,
    analysisMetadata: metadata ? {
      status: metadata.status,
      confidence: metadata.confidence,
      warnings: compactStrings(metadata.warnings, 4, 160),
      evidenceSources: compactEvidence(metadata.evidenceSources),
      analysisVersion: metadata.analysisVersion,
      contentType: metadata.contentType,
      evidenceLevel: metadata.evidenceLevel,
      semanticConcepts: Array.isArray(metadata.semanticConcepts) ? metadata.semanticConcepts.slice(0, 48).filter((concept) => concept && typeof concept.concept === "string").map((concept) => ({ ...concept, concept: concept.concept.slice(0, 120) })) : undefined,
      visualEvidence: metadata.visualEvidence ? { ...metadata.visualEvidence, concepts: compactStrings(metadata.visualEvidence.concepts, 20, 120), primaryObjects: compactStrings(metadata.visualEvidence.primaryObjects, 8, 80), attributes: compactStrings(metadata.visualEvidence.attributes, 12, 80), relationships: compactStrings(metadata.visualEvidence.relationships, 12, 120), visualDescription: typeof metadata.visualEvidence.visualDescription === "string" ? metadata.visualEvidence.visualDescription.slice(0, 400) : undefined } : undefined,
      structuredContent: {
        ...(Array.isArray(ingredients) ? { ingredients: ingredients.slice(0, 20) } : {}),
        ...(Array.isArray(steps) ? { steps: steps.slice(0, 20) } : {}),
      },
    } : null,
  };
}
