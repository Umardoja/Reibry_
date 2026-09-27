import assert from "node:assert/strict";
import test from "node:test";
import { deriveTags } from "../src/lib/sources/enrichment.ts";
import { retrievalService } from "../src/lib/retrieval/service.ts";
import { validateEmbedding } from "../src/lib/ai/nvidia/schemas.ts";
import type { Memory } from "../src/types/reibry.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function memory(id: string, title: string, tags: string[], category: string): Memory {
  return {
    id,
    userId,
    title,
    summary: title,
    category,
    tags,
    entities: [],
    sourceUrl: null,
    sourcePlatform: null,
    sourceType: "text",
    rawText: title,
    possibleIntents: [],
    possibleActions: [],
    analysisStatus: "complete",
    confidence: 0.8,
    evidenceSources: [],
    analysisMetadata: null,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };
}

test("maths retrieves a calculus and algebra Memory through canonical concepts", async () => {
  const saved = memory("11111111-1111-4111-8111-111111111111", "Solving calculus and algebraic equations", deriveTags("calculus algebra"), "Education & Learning");
  const result = await retrievalService.searchMemories({ userId, query: "mathematics", limit: 10, minimumScore: 0.05, memories: [saved] });
  assert.equal(result[0]?.memory.id, saved.id);
});

test("coding retrieves a Python and programming Memory", async () => {
  const saved = memory("22222222-2222-4222-8222-222222222222", "Understanding Python decorators", deriveTags("Python programming"), "Technology");
  const result = await retrievalService.searchMemories({ userId, query: "programming", limit: 10, minimumScore: 0.05, memories: [saved] });
  assert.equal(result[0]?.memory.id, saved.id);
});

test("money retrieves a budgeting and finance Memory", async () => {
  const saved = memory("33333333-3333-4333-8333-333333333333", "Monthly budget and expenses", deriveTags("budget finance"), "Finance");
  const result = await retrievalService.searchMemories({ userId, query: "finance", limit: 10, minimumScore: 0.05, memories: [saved] });
  assert.equal(result[0]?.memory.id, saved.id);
});

test("unrelated queries do not rank unrelated Memories positively", async () => {
  const saved = memory("44444444-4444-4444-8444-444444444444", "Solving calculus and algebraic equations", deriveTags("calculus algebra"), "Education & Learning");
  const result = await retrievalService.searchMemories({ userId, query: "ocean sailing", limit: 10, minimumScore: 0.05, memories: [saved] });
  assert.equal(result.length, 0);
});

test("deterministic vector output contract remains 2048 finite dimensions", () => {
  const vector = Array.from({ length: 2048 }, (_, index) => (index % 17) / 17);
  const validated = validateEmbedding(vector);
  assert.equal(validated.length, 2048);
  assert.ok(validated.every(Number.isFinite));
  assert.deepEqual(validated, validateEmbedding([...vector]));
});

test("concept aliases normalize consistently across capture and search", () => {
  const mathematics = new Set(deriveTags("maths mathematics calculus algebra"));
  const programming = new Set(deriveTags("coding code Python programming"));
  const finance = new Set(deriveTags("money budget finance expenses"));
  assert.ok(mathematics.has("mathematics") && mathematics.has("education"));
  assert.ok(programming.has("programming") && programming.has("technology"));
  assert.ok(finance.has("finance") && finance.has("budget"));
});
