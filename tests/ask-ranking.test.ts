import assert from "node:assert/strict";
import test from "node:test";
import { retrievalService } from "../src/lib/retrieval/service.ts";
import type { Memory } from "../src/types/reibry.ts";
import { memoryEmbeddingText } from "../src/lib/intelligence/embedding-text.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let sequence = 0;
function memory(title: string, overrides: Partial<Memory> = {}): Memory {
  const id = overrides.id || `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  return {
    id, userId, title, summary: overrides.summary ?? title, category: overrides.category ?? "Other", tags: overrides.tags ?? [], entities: overrides.entities ?? [],
    sourceUrl: null, sourcePlatform: overrides.sourcePlatform ?? null, sourceType: overrides.sourceType ?? "text", rawText: overrides.rawText ?? title,
    possibleIntents: [], possibleActions: [], analysisStatus: "complete", confidence: 0.8, evidenceSources: [], analysisMetadata: overrides.analysisMetadata ?? null,
    createdAt: overrides.createdAt ?? "2026-05-12T12:00:00.000Z", updatedAt: "2026-05-12T12:00:00.000Z", ...overrides,
  };
}

async function ids(query: string, memories: Memory[], minimumScore = 0.22) {
  return (await retrievalService.searchMemories({ userId, query, limit: 10, minimumScore, memories })).map((result) => result.memory.id);
}

test("exact title match ranks above summary-only match", async () => {
  const exact = memory("Fresh orange juice recipe", { summary: "A useful saved drink" });
  const summary = memory("Kitchen drinks", { summary: "A fresh orange juice idea" });
  assert.deepEqual((await ids("orange juice", [summary, exact])).slice(0, 2), [exact.id, summary.id]);
});

test("exact canonical concept ranks above weak related concept", async () => {
  const direct = memory("Orange juice tutorial", { tags: ["orange", "juice"] });
  const weak = memory("Fruit drink ideas", { tags: ["drink", "fruit"] });
  assert.equal((await ids("orange", [weak, direct]))[0], direct.id);
});

test("orange query orders orange juice before broader fruit content", async () => {
  const juice = memory("Fresh orange juice recipe", { tags: ["orange", "juice"] });
  const smoothie = memory("Banana and orange smoothie", { tags: ["orange", "banana"] });
  const cake = memory("Chocolate cake", { tags: ["cake"], category: "Food & Cooking" });
  assert.deepEqual(await ids("orange", [cake, smoothie, juice]), [juice.id, smoothie.id]);
});

test("thumbnail-derived heart cake concept ranks first", async () => {
  const visual = memory("Made this today", { analysisMetadata: { status: "partial", confidence: 0.7, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "heart-shaped cake", source: "thumbnail", strength: "direct" }], visualEvidence: { source: "thumbnail", analyzed: true, concepts: ["heart-shaped cake"] } } });
  const recipe = memory("Cake recipe", { tags: ["cake", "recipe"] });
  const generic = memory("Dessert ideas", { tags: ["dessert"] });
  assert.equal((await ids("heart cake", [generic, recipe, visual]))[0], visual.id);
});

test("apron-shaped cake relationship outranks generic cake and incidental apron evidence", async () => {
  const shaped = memory("Cakes in Owerri by Lixloria Events", { summary: "A TikTok video by a cake vendor in Owerri.", sourceType: "link", sourcePlatform: "tiktok", analysisMetadata: { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "apron-shaped cake", source: "thumbnail", strength: "direct" }, { concept: "chef apron cake", source: "thumbnail", strength: "direct" }], visualEvidence: { source: "thumbnail", analyzed: true, concepts: ["apron-shaped cake", "chef apron cake", "decorated cake"], primaryObjects: ["cake"], attributes: ["white decorated cake"], relationships: ["cake is designed to resemble a chef apron"], confidence: "high" } } });
  const incidental = memory("Cake decorating video", { summary: "A person wearing an apron decorates a normal round cake.", tags: ["cake", "apron"] });
  const genericCake = memory("Chocolate cake recipe", { tags: ["cake"] });
  for (const query of ["apron cake", "cake shaped like an apron", "chef apron cake", "that cake that looked like an apron", "the cake designed like a chef apron", "I'm looking for a cake video where the cake was an apron", "find that weird apron cake"]) {
    assert.equal((await ids(query, [genericCake, incidental, shaped]))[0], shaped.id, query);
  }
});

test("generic cake or apron evidence alone cannot satisfy a shaped-cake search", async () => {
  const cake = memory("Chocolate cake recipe", { tags: ["cake"] });
  const apron = memory("Chef apron outfit", { summary: "A chef wears a white apron." });
  assert.deepEqual(await ids("apron-shaped cake", [cake, apron]), []);
});

test("incidental apron on a person is not interpreted as an apron-shaped cake", async () => {
  const incidental = memory("Cake decorating video", { summary: "A person wearing an apron decorates a normal round cake.", tags: ["cake", "apron"], analysisMetadata: { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "cake", source: "thumbnail", strength: "direct" }, { concept: "apron", source: "thumbnail", strength: "direct" }], visualEvidence: { source: "thumbnail", analyzed: true, concepts: ["cake", "apron", "person wearing apron"] } } });
  assert.deepEqual(await ids("apron-shaped cake", [incidental]), []);
});

test("observed chef-jacket-themed cake ranks first and ordinary cakes are gated out", async () => {
  const jacketCake = memory("Cakes in Owerri by Lixloria Events", { analysisMetadata: { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "chef jacket design", source: "thumbnail", strength: "direct" }, { concept: "novelty cake", source: "thumbnail", strength: "direct" }], visualEvidence: { source: "thumbnail", analyzed: true, visualDescription: "An individual holding a chef jacket-themed cake in front of a marbled wall.", concepts: ["chef jacket design", "novelty cake"], relationships: ["cake held in hands"] } } });
  const ordinary = memory("Red velvet cake tutorial", { tags: ["cake", "baking"] });
  const results = await ids("Find the cake shaped like a chef jacket", [ordinary, jacketCake]);
  assert.deepEqual(results, [jacketCake.id]);
});

test("deterministic embedding input includes grounded visual relationships", () => {
  const item = memory("Made this today", { analysisMetadata: { status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "apron-shaped cake", source: "thumbnail", strength: "direct" }], visualEvidence: { source: "thumbnail", analyzed: true, concepts: ["apron-shaped cake"], relationships: ["cake is designed to resemble a chef apron"] } } });
  assert.match(memoryEmbeddingText(item), /apron-shaped cake/);
  assert.match(memoryEmbeddingText(item), /designed to resemble a chef apron/);
});

test("unrelated memories are removed instead of filling the result list", async () => {
  const cake = memory("Chocolate cake", { tags: ["cake"] });
  assert.deepEqual(await ids("car engine repair", [cake]), []);
});

test("duplicate lexical and vector candidates return once", async () => {
  const item = memory("Orange juice recipe");
  assert.deepEqual(await ids("orange", [item, item]), [item.id]);
});

test("equal scores use deterministic ID tie-breakers", async () => {
  const left = memory("Orange note", { id: "00000000-0000-4000-8000-000000000010" });
  const right = memory("Orange note", { id: "00000000-0000-4000-8000-000000000020" });
  assert.deepEqual(await ids("orange", [right, left]), [left.id, right.id]);
});

test("recency does not outrank stronger relevance", async () => {
  const strong = memory("Orange juice recipe", { createdAt: "2026-01-01T00:00:00.000Z" });
  const recent = memory("Kitchen note", { summary: "A fruit thought", createdAt: "2026-09-01T00:00:00.000Z" });
  assert.equal((await ids("orange juice", [recent, strong]))[0], strong.id);
});

test("plural normalization keeps orange and oranges equivalent", async () => {
  const item = memory("Fresh orange juice");
  assert.deepEqual(await ids("oranges", [item]), [item.id]);
});

test("category-only overlap does not pass the relevance gate", async () => {
  const food = memory("Kitchen note", { category: "Food & Cooking", summary: "A general note" });
  assert.deepEqual(await ids("food", [food]), []);
});

test("no-match returns an empty set", async () => {
  assert.deepEqual(await ids("Barcelona hotel recommendations", [memory("FastAPI backend tutorial")]), []);
});
