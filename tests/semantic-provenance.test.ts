import assert from "node:assert/strict";
import test from "node:test";
import { enrichAnalysisMetadata } from "../src/lib/intelligence/evidence.ts";
import { semanticConcepts } from "../src/lib/retrieval/concepts.ts";
import { retrievalService } from "../src/lib/retrieval/service.ts";
import type { AIAnalysisMetadata, Memory } from "../src/types/reibry.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const baseMetadata: AIAnalysisMetadata = { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [] };

function memory(title: string, overrides: Partial<Memory> = {}): Memory {
  return {
    id: "00000000-0000-4000-8000-000000000731", userId, title, summary: title, category: "Food & Cooking",
    tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: title,
    possibleIntents: [], possibleActions: [], analysisStatus: "complete", confidence: 0.9, evidenceSources: [], analysisMetadata: null,
    createdAt: "2026-09-25T10:00:00.000Z", updatedAt: "2026-09-25T10:00:00.000Z", ...overrides,
  };
}

test("red velvet source concepts are direct and do not contain unsupported cake relationships", () => {
  const result = enrichAnalysisMetadata(memory("The ULTIMATE Red Velvet Cake - soft, moist, and extremely easy to make! #redvelvet #cake #baking"), baseMetadata);
  const concepts = result.semanticConcepts || [];
  assert.ok(concepts.some((entry) => entry.concept === "red velvet cake" && entry.source === "title" && entry.strength === "exact"));
  assert.ok(concepts.some((entry) => entry.concept === "cake" && entry.source === "title" && entry.strength === "exact"));
  assert.ok(!concepts.some((entry) => ["butterfly", "vanilla", "shaped cake"].includes(entry.concept)));
  assert.ok(!concepts.some((entry) => ["ultimate", "youtube", "short", "extremely"].includes(entry.concept)));
});

test("provenance is retained for summary, tags, thumbnail, and relationships", () => {
  const summary = semanticConcepts([{ text: "FastAPI backend tutorial", source: "summary" }]);
  assert.equal(summary.find((entry) => entry.concept === "fastapi")?.source, "summary");
  const tags = semanticConcepts([{ text: "orange juice", source: "tags" }]);
  assert.equal(tags.find((entry) => entry.concept === "orange juice")?.source, "tags");
  const thumbnail = semanticConcepts([{ text: "butterfly-shaped cake decoration", source: "thumbnail" }]);
  assert.equal(thumbnail.find((entry) => entry.concept === "butterfly")?.source, "thumbnail");
  const relationship = semanticConcepts([{ text: "orange juice", source: "title" }]).find((entry) => entry.concept === "citrus");
  assert.deepEqual(relationship && { source: relationship.source, strength: relationship.strength }, { source: "relationship", strength: "related" });
});

test("visual butterfly cake is searchable without title provenance", async () => {
  const visual = memory("Made this today", {
    analysisMetadata: { ...baseMetadata, status: "partial", semanticConcepts: [
      { concept: "butterfly cake", source: "thumbnail", strength: "direct" },
      { concept: "cake decoration", source: "thumbnail", strength: "direct" },
    ], visualEvidence: { source: "thumbnail", analyzed: true, concepts: ["butterfly-shaped cake", "cake decoration"] } },
  });
  const result = await retrievalService.searchMemories({ userId, query: "butterfly cake", limit: 5, memories: [visual] });
  assert.equal(result[0]?.memory.id, visual.id);
  assert.ok(result[0].similarity > 0);
});

test("sequential analyses are isolated and orange plural behavior remains intact", () => {
  const butterfly = enrichAnalysisMetadata(memory("Butterfly cake decoration"), baseMetadata);
  const redVelvet = enrichAnalysisMetadata(memory("Red velvet cake"), baseMetadata);
  assert.ok((butterfly.semanticConcepts || []).some((entry) => entry.concept === "butterfly"));
  assert.ok(!(redVelvet.semanticConcepts || []).some((entry) => entry.concept === "butterfly"));
  const orange = semanticConcepts([{ text: "Fresh Orange Juice Recipe", source: "title" }]);
  assert.ok(orange.some((entry) => entry.concept === "orange"));
  assert.ok(orange.some((entry) => entry.concept === "juice"));
});

test("malformed historical title exact concepts are ignored by retrieval defense", async () => {
  const malformed = memory("Red velvet cake", { analysisMetadata: { ...baseMetadata, semanticConcepts: [{ concept: "butterfly", source: "title", strength: "exact" }] } });
  const result = await retrievalService.searchMemories({ userId, query: "butterfly", limit: 5, memories: [malformed] });
  assert.deepEqual(result, []);
});
