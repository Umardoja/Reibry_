import type { Memory } from "@/types/reibry";
import { matchesHints, normalizedTerms, normalizeVisualSearchQuery, parseRetrievalHints, sourceKind, visualRelationQuery } from "./understanding.ts";
import { conceptScore, conceptTokens } from "./concepts.ts";
export type RetrievalResult = { memory: Memory; similarity: number; reason?: string };

function intersection(left: Set<string>, right: Set<string>) { return [...left].filter((term) => right.has(term)); }
function bounded(value: number) { return Math.max(0, Math.min(1, value)); }

function trustedSemanticConcepts(memory: Memory) {
  const title = conceptTokens(memory.title);
  const tags = new Set(memory.tags.flatMap((tag) => [...conceptTokens(tag)]));
  const entities = new Set(memory.entities.flatMap((entity) => [...conceptTokens(entity.name)]));
  const visual = new Set((memory.analysisMetadata?.visualEvidence?.concepts || []).flatMap((concept) => [...conceptTokens(concept)]));
  return (memory.analysisMetadata?.semanticConcepts || []).filter((entry) => {
    const tokens = [...conceptTokens(entry.concept)];
    if (!tokens.length) return false;
    if (entry.source === "title") return tokens.every((token) => title.has(token));
    if (entry.source === "thumbnail") return Boolean(memory.analysisMetadata?.visualEvidence?.analyzed) && tokens.every((token) => visual.has(token));
    if (entry.source === "tags") return tokens.every((token) => tags.has(token));
    if (entry.source === "entities") return tokens.every((token) => entities.has(token));
    return entry.source === "relationship" ? entry.strength === "related" : true;
  });
}

export interface RetrievalService {
  searchMemories(input: { userId: string; query: string; limit: number; minimumScore?: number; memories: Memory[]; vectorSimilarities?: ReadonlyMap<string, number> }): Promise<RetrievalResult[]>;
}
export const retrievalService: RetrievalService = {
  async searchMemories({ query, limit, minimumScore = 0.22, memories, vectorSimilarities = new Map() }) {
    const searchQuery = normalizeVisualSearchQuery(query);
    const relationQuery = visualRelationQuery(query);
    const queryTerms = normalizedTerms(searchQuery);
    const hints = parseRetrievalHints(query);
    if (!queryTerms.size) return [];
    const uniqueMemories = [...new Map(memories.map((memory) => [memory.id, memory])).values()];
    return uniqueMemories
      .filter((memory) => memory.analysisStatus !== "failed" && memory.analysisStatus !== "processing" && matchesHints(memory, hints))
      .map((memory) => {
        const title = normalizedTerms(memory.title);
        const summary = normalizedTerms(`${memory.summary || ""} ${memory.rawText || ""}`);
        const semanticEntries = trustedSemanticConcepts(memory);
        const semantic = semanticEntries.map((entry) => entry.concept).join(" ");
        const metadata = normalizedTerms(`${memory.tags.join(" ")} ${memory.entities.map((entity) => entity.name).join(" ")} ${memory.possibleIntents.join(" ")} ${semantic}`);
        const categoryTerms = normalizedTerms(memory.category || "");
        const titleHits = intersection(queryTerms, title);
        const bodyHits = intersection(queryTerms, summary);
        const metadataHits = intersection(queryTerms, metadata);
        const categoryHits = intersection(queryTerms, categoryTerms);
        const visualHits = intersection(queryTerms, normalizedTerms(semantic));
        const visualEvidence = memory.analysisMetadata?.visualEvidence;
        const relationshipText = [...(visualEvidence?.relationships || []), ...(visualEvidence?.concepts || [])].join(" ").toLowerCase();
        const literalEvidenceText = [memory.title, memory.summary, memory.rawText, ...memory.tags, ...memory.entities.map((item) => item.name), ...memory.evidenceSources.flatMap((source) => [source.title, source.caption, source.transcript])].filter(Boolean).join(" ").toLowerCase();
        const designTokens = relationQuery ? [...conceptTokens(relationQuery.design)] : [];
        const explicitlyDescribesRelationship = (text: string) => {
          const normalized = text.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim();
          if (!normalized.includes("cake") || !designTokens.length || !designTokens.every((token) => normalized.includes(token))) return false;
          // A distinctive cake request needs a phrase or explicit relation, not co-occurrence nearby.
          const design = designTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[- ]+");
          if (new RegExp(`(?:${design})[- ]+(?:(?:shaped|themed|decorated|design)[- ]+)?cake|cake[- ]+(?:with|has|featuring)[- ]+(?:a[- ]+)?${design}`).test(normalized)) return true;
          // Require an observed relation between the cake and the described design.
          return /cake.{0,60}(?:shaped|designed|themed|resembl|look(?:s|ed)? like|made (?:to look|into)).{0,60}(?:butterfly|apron|jacket|heart|car|football|flower|shoe|phone|book|character|chef)/.test(normalized) ||
            /(?:butterfly|apron|jacket|heart|car|football|flower|shoe|phone|book|character|chef).{0,60}(?:shaped|designed|themed|resembl|look(?:s|ed)? like|made (?:to look|into)).{0,60}cake/.test(normalized) ||
            /(?:butterfly|apron|jacket|heart|car|football|flower|shoe|phone|book|character|chef)[- ]themed cake/.test(normalized);
        };
        const relationshipMatch = Boolean(relationQuery && (explicitlyDescribesRelationship(relationshipText) || explicitlyDescribesRelationship(visualEvidence?.visualDescription || "") || explicitlyDescribesRelationship(literalEvidenceText)));
        const evidence = new Set([...titleHits, ...bodyHits, ...metadataHits]);
        const concepts = conceptScore(query, [
          { text: memory.title, source: "title" }, { text: memory.summary, source: "summary" },
          { text: memory.rawText, source: "raw" }, { text: memory.tags.join(" "), source: "tags" },
          { text: memory.entities.map((entity) => entity.name).join(" "), source: "entities" },
          { text: semantic, source: "thumbnail" },
        ]);
        const normalizedQuery = [...queryTerms].join(" ");
        const normalizedTitle = [...title].join(" ");
        const exactPhrase = normalizedQuery.length > 2 && normalizedTitle.includes(normalizedQuery);
        const titleCoverage = titleHits.length / queryTerms.size;
        const vector = bounded(vectorSimilarities.get(memory.id) ?? 0);
        const similarity = bounded(
          (exactPhrase ? 0.42 : 0) +
          titleCoverage * 0.28 +
          concepts * 0.3 +
          (visualHits.length / queryTerms.size) * 0.38 +
          (metadataHits.length / queryTerms.size) * 0.14 +
          (bodyHits.length / queryTerms.size) * 0.1 +
          vector * 0.12 +
          (relationshipMatch ? 0.32 : 0) +
          (hints.source && sourceKind(memory) === hints.source ? 0.08 : 0) +
          (hints.from ? 0.04 : 0),
        );
        const reason = titleHits.length ? "Its title matches what you described." : metadataHits.length ? "Its saved topics match what you described." : bodyHits.length ? "Its saved content matches what you described." : undefined;
        return { memory, similarity, reason, evidenceCount: evidence.size, categoryOnly: categoryHits.length > 0 && evidence.size === 0, titleHits: titleHits.length, metadataHits: metadataHits.length, bodyHits: bodyHits.length, relationshipMatch };
      })
      // A closest vector alone is not proof. At least one grounded text/concept signal must agree.
      .filter((result) => !result.categoryOnly && result.evidenceCount > 0 && result.similarity >= minimumScore && (!relationQuery || result.relationshipMatch))
      .sort((left, right) => right.similarity - left.similarity || right.titleHits - left.titleHits || right.metadataHits - left.metadataHits || right.bodyHits - left.bodyHits || Date.parse(right.memory.createdAt) - Date.parse(left.memory.createdAt) || left.memory.id.localeCompare(right.memory.id))
      .slice(0, limit)
      .map(({ memory, similarity, reason }) => ({ memory, similarity, reason }));
  },
};
