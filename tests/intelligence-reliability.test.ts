import assert from "node:assert/strict";
import test from "node:test";
import { deterministicLifeFallback, fallbackLifeTitle } from "../src/lib/integration/life-fallback.ts";
import { enrichAnalysisMetadata, evidenceSufficiency } from "../src/lib/intelligence/evidence.ts";
import { retrievalService } from "../src/lib/retrieval/service.ts";
import { memoryDateRange, parseMemoryListQuery } from "../src/lib/memories/filters.ts";
import type { AIAnalysisMetadata, Memory } from "../src/types/reibry.ts";
import { sourcePreservation } from "../src/lib/capture/source-preservation.ts";
import { meaningfulAction } from "../src/lib/actions/policy.ts";
import type { LifeContext } from "../src/types/reibry.ts";
import { partitionLifeContexts, isDuplicateLifeContext } from "../src/lib/life/management.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const referenceNow = "2026-09-22T10:00:00.000Z";

function memory(input: Partial<Memory> & Pick<Memory, "id" | "title">): Memory {
  return {
    id: input.id, userId, title: input.title,
    summary: input.summary ?? input.title,
    category: input.category ?? "Other",
    tags: input.tags ?? [], entities: input.entities ?? [],
    sourceUrl: input.sourceUrl ?? null, sourcePlatform: input.sourcePlatform ?? null,
    sourceType: input.sourceType ?? "text", rawText: input.rawText ?? input.title,
    possibleIntents: input.possibleIntents ?? [], possibleActions: input.possibleActions ?? [],
    analysisStatus: input.analysisStatus ?? "complete", confidence: input.confidence ?? 0.8,
    evidenceSources: input.evidenceSources ?? [], analysisMetadata: input.analysisMetadata ?? null,
    createdAt: input.createdAt ?? "2026-05-12T12:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-05-12T12:00:00.000Z",
  };
}

const metadata: AIAnalysisMetadata = { status: "complete", confidence: 0.9, provider: "gemini", warnings: [], evidenceSources: [] };

test("Life fallback preserves a cake request and resolves tomorrow morning", () => {
  const result = deterministicLifeFallback({ text: "I would really like to bake a cake tomorrow morning", timezone: "Africa/Lagos", referenceNow });
  assert.equal(result.contexts[0].title, "Bake a cake");
  assert.equal(result.contexts[0].description, "I would really like to bake a cake tomorrow morning");
  assert.equal(result.contexts[0].startDate, "2026-09-23T08:00:00.000Z");
  assert.equal(result.metadata.status, "partial");
});

test("Life management separates upcoming, undated, and past contexts", () => {
  const base = (id: string, startDate: string | null, status: "active" | "completed" = "active"): LifeContext => ({ id, userId, type: "event", title: id, description: null, startDate, endDate: null, status, confidence: null, createdAt: referenceNow, updatedAt: referenceNow });
  const groups = partitionLifeContexts([base("past", "2026-09-20T09:00:00.000Z"), base("soon", "2026-09-24T09:00:00.000Z"), base("none", null), base("done", "2026-09-30T09:00:00.000Z", "completed")], new Date(referenceNow));
  assert.deepEqual(groups.upcoming.map((item) => item.id), ["soon"]); assert.deepEqual(groups.undated.map((item) => item.id), ["none"]); assert.deepEqual(groups.past.map((item) => item.id), ["done", "past"]);
});

test("Life duplicate protection is conservative", () => {
  const existing = { title: "Software engineering presentation", description: null, startDate: "2026-09-24T13:00:00.000Z" } as LifeContext;
  assert.equal(isDuplicateLifeContext(existing, { title: "Software engineering presentation", description: null, startDate: "2026-09-24T13:04:00.000Z" }), true);
  assert.equal(isDuplicateLifeContext(existing, { title: "Software engineering presentation", description: null, startDate: "2026-09-25T13:00:00.000Z" }), false);
});

test("Life fallback resolves explicit weekday, daypart, and ambiguous dates conservatively", () => {
  const presentation = deterministicLifeFallback({ text: "My presentation is Thursday at 2 PM", timezone: "Africa/Lagos", referenceNow });
  const birthday = deterministicLifeFallback({ text: "Mum's birthday is Saturday evening", timezone: "Africa/Lagos", referenceNow });
  const ambiguous = deterministicLifeFallback({ text: "I'm planning something sometime later", timezone: "Africa/Lagos", referenceNow });
  assert.equal(presentation.contexts[0].startDate, "2026-09-24T13:00:00.000Z");
  assert.equal(birthday.contexts[0].startDate, "2026-09-26T18:00:00.000Z");
  assert.equal(ambiguous.contexts[0].startDate, null);
});

test("Life fallback titles stay bounded and source-derived", () => {
  const source = `I want to ${"prepare carefully ".repeat(20)}tomorrow`;
  const title = fallbackLifeTitle(source);
  assert.ok(title.length <= 120);
  assert.ok(source.toLowerCase().includes(title.slice(0, 12).toLowerCase()));
});

test("Ask retrieves cake memories for grounded recipe queries", async () => {
  const cake = memory({ id: "11111111-1111-4111-8111-111111111111", title: "Red velvet cake tutorial", summary: "A saved cake recipe with cream cheese frosting", tags: ["cake", "recipe", "baking"], category: "Food & Cooking" });
  for (const query of ["cake recipe", "ingredients for the cake I saved"]) {
    const results = await retrievalService.searchMemories({ userId, query, limit: 5, memories: [cake] });
    assert.equal(results[0]?.memory.id, cake.id);
  }
});

test("Ask retrieves Python and maths memories without cross-domain noise", async () => {
  const fastapi = memory({ id: "22222222-2222-4222-8222-222222222222", title: "FastAPI backend tutorial", tags: ["python", "fastapi", "backend"], category: "Technology" });
  const maths = memory({ id: "33333333-3333-4333-8333-333333333333", title: "Calculus revision shortcuts", tags: ["maths", "calculus", "revision"], category: "Education & Learning" });
  const pythonResults = await retrievalService.searchMemories({ userId, query: "Python backend tutorial", limit: 5, memories: [fastapi, maths] });
  const mathsResults = await retrievalService.searchMemories({ userId, query: "revision shortcuts for maths", limit: 5, memories: [fastapi, maths] });
  assert.equal(pythonResults[0]?.memory.id, fastapi.id);
  assert.equal(mathsResults[0]?.memory.id, maths.id);
  assert.equal(pythonResults.some((result) => result.memory.id === maths.id), false);
});

test("Ask returns no match when no grounded evidence overlaps", async () => {
  const cake = memory({ id: "44444444-4444-4444-8444-444444444444", title: "Cake recipe", tags: ["cake", "recipe"] });
  assert.deepEqual(await retrievalService.searchMemories({ userId, query: "car engine repair", limit: 5, memories: [cake] }), []);
});

test("Ask applies natural month hints before ranking", async () => {
  const may = memory({ id: "55555555-5555-4555-8555-555555555555", title: "Python video", tags: ["python"], createdAt: "2026-05-15T12:00:00.000Z" });
  const june = memory({ id: "66666666-6666-4666-8666-666666666666", title: "Python video", tags: ["python"], createdAt: "2026-06-15T12:00:00.000Z" });
  assert.deepEqual((await retrievalService.searchMemories({ userId, query: "Python video from May 2026", limit: 5, memories: [may, june] })).map((result) => result.memory.id), [may.id]);
});

test("Ask applies source hints before ranking", async () => {
  const tiktok = memory({ id: "77777777-7777-4777-8777-777777777777", title: "Cake decorating video", tags: ["cake"], sourceType: "social_post", sourcePlatform: "TikTok" });
  const web = memory({ id: "88888888-8888-4888-8888-888888888888", title: "Cake decorating article", tags: ["cake"], sourceType: "article", sourcePlatform: "Example" });
  assert.deepEqual((await retrievalService.searchMemories({ userId, query: "TikTok video about cake", limit: 5, memories: [web, tiktok] })).map((result) => result.memory.id), [tiktok.id]);
});

test("failed and processing memories are excluded from Ask", async () => {
  const failed = memory({ id: "99999999-9999-4999-8999-999999999999", title: "Cake recipe", analysisStatus: "failed" });
  const processing = memory({ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", title: "Cake recipe", analysisStatus: "processing" });
  assert.deepEqual(await retrievalService.searchMemories({ userId, query: "cake recipe", limit: 5, memories: [failed, processing] }), []);
});

test("recipe structure includes only explicitly evidenced ingredients and steps", () => {
  const recipe = memory({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Bread recipe", rawText: "Ingredients:\n2 cups flour\n1. Mix flour and water\n2. Bake for 30 minutes", tags: ["recipe"] });
  const enriched = enrichAnalysisMetadata(recipe, metadata);
  assert.equal(enriched.contentType, "recipe");
  assert.deepEqual(enriched.structuredContent?.ingredients, ["Ingredients:", "2 cups flour"]);
  assert.deepEqual(enriched.structuredContent?.steps, ["1. Mix flour and water", "2. Bake for 30 minutes"]);
  assert.equal(JSON.stringify(enriched.structuredContent).includes("salt"), false);
});

test("tutorial structure remains grounded in summary, tags, and entities", () => {
  const tutorial = memory({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "FastAPI tutorial", summary: "Learn dependency injection", tags: ["fastapi", "python"], entities: [{ name: "FastAPI", type: "technology" }] });
  const enriched = enrichAnalysisMetadata(tutorial, metadata);
  assert.equal(enriched.contentType, "learning-resource");
  assert.equal(enriched.structuredContent?.whatItTeaches, "Learn dependency injection");
  assert.deepEqual(enriched.structuredContent?.keyConcepts, ["fastapi", "python", "FastAPI"]);
});

test("evidence sufficiency escalates weak evidence and accepts useful evidence", () => {
  const weak = memory({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", title: "Captured memory", rawText: "😂🔥", evidenceSources: [] });
  const strong = memory({ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", title: "FastAPI dependency injection tutorial", rawText: "A detailed explanation of dependencies, request scopes, testing, and reusable backend services in FastAPI.", evidenceSources: [] });
  assert.equal(evidenceSufficiency(weak).sufficient, false);
  assert.equal(evidenceSufficiency(strong).sufficient, true);
});

test("Memory date presets produce deterministic server boundaries", () => {
  const now = new Date(2026, 4, 20, 12);
  const month = memoryDateRange({ preset: "choose-month", month: "2026-05", referenceNow: now });
  const custom = memoryDateRange({ preset: "custom", customFrom: "2026-05-04", customTo: "2026-05-09", referenceNow: now });
  assert.equal(month.from, new Date(2026, 4, 1).toISOString());
  assert.equal(month.to, new Date(2026, 5, 1).toISOString());
  assert.equal(custom.from, new Date(2026, 4, 4).toISOString());
  assert.equal(custom.to, new Date(2026, 4, 10).toISOString());
});

test("Memory list query combines category, source, search, and date before pagination", () => {
  const params = new URLSearchParams({ limit: "20", category: "Food & Cooking", source: "tiktok", search: "cake", from: "2026-05-01", to: "2026-06-01" });
  const result = parseMemoryListQuery(params);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.options, { limit: 20, cursor: undefined, search: "cake", category: "Food & Cooking", source: "tiktok", from: "2026-05-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" });
});

test("Memory list query rejects invalid or reversed date ranges", () => {
  assert.ok(parseMemoryListQuery(new URLSearchParams({ from: "later" })).error);
  assert.ok(parseMemoryListQuery(new URLSearchParams({ from: "2026-06-01", to: "2026-05-01" })).error);
});

test("source fallback classifies an evidenced cake recipe and keeps useful tags", () => {
  const result = sourcePreservation({ sourceType: "social_post", sourceUrl: "https://www.tiktok.com/example", rawText: "Simple vanilla cake recipe 500g flour 2 cups sugar baking powder", evidence: [{ platform: "TikTok", title: "Simple vanilla cake recipe 500g flour 2 cups sugar baking powder", caption: "Simple vanilla cake recipe 500g flour 2 cups sugar baking powder" }] });
  assert.equal(result.memory.category, "Food & Cooking");
  assert.ok(result.memory.tags?.includes("cake"));
  assert.ok(result.memory.tags?.includes("recipe"));
  assert.equal(result.memory.title, "Simple vanilla cake recipe");
  assert.match(result.memory.summary || "", /ingredient quantities/);
  assert.match(result.metadata.evidenceSources[0].caption || "", /500g flour/);
});

test("source fallback derives programming metadata without inventing entities or intents", () => {
  const result = sourcePreservation({ sourceType: "text", rawText: "Learning Python and FastAPI for backend APIs", evidence: [{ modality: "text", caption: "Learning Python and FastAPI for backend APIs" }] });
  assert.equal(result.memory.category, "Technology");
  assert.deepEqual(result.memory.entities, []);
  assert.deepEqual(result.memory.possibleIntents, []);
  assert.ok(result.memory.tags?.includes("python"));
});

test("recipe actions use structured ingredients rather than a generic checklist", () => {
  const recipe = memory({ id: "abababab-abab-4bab-8bab-abababababab", title: "Vanilla cake", category: "Food & Cooking", analysisMetadata: { ...metadata, contentType: "recipe", structuredContent: { ingredients: ["500g flour", "2 cups sugar"] } } });
  const life: LifeContext = { id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd", userId, type: "event", title: "Bake for Saturday", description: null, startDate: null, endDate: null, status: "active", confidence: 0.8, createdAt: referenceNow, updatedAt: referenceNow };
  const action = meaningfulAction(recipe, life, "checklist");
  assert.equal(action?.type, "shopping_list");
  assert.equal(action?.label, "Create ingredient list");
  assert.deepEqual(action?.payload.items, ["500g flour", "2 cups sugar"]);
});

test("generic Memories do not receive a generic checklist action", () => {
  const note = memory({ id: "efefefef-efef-4fef-8fef-efefefefefef", title: "A thought to remember" });
  const life: LifeContext = { id: "12121212-1212-4212-8212-121212121212", userId, type: "event", title: "Weekend", description: null, startDate: null, endDate: null, status: "active", confidence: null, createdAt: referenceNow, updatedAt: referenceNow };
  assert.equal(meaningfulAction(note, life, "checklist"), null);
});

test("recipe Memories without evidenced ingredients do not become task checklists", () => {
  const recipe = memory({ id: "34343434-3434-4434-8434-343434343434", title: "Cake decorating tutorial", category: "Food & Cooking" });
  const life: LifeContext = { id: "56565656-5656-4565-8565-565656565656", userId, type: "task", title: "Bake a cake", description: null, startDate: null, endDate: null, status: "active", confidence: 0.8, createdAt: referenceNow, updatedAt: referenceNow };
  assert.equal(meaningfulAction(recipe, life, "checklist"), null);
});
