import assert from "node:assert/strict";
import test from "node:test";
import { geminiAI } from "../src/lib/integration/gemini.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;

function restore() {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status });
}

test.afterEach(restore);

test("Gemini memory analysis validates canonical category output", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.equal(body.generationConfig.responseSchema.type, "OBJECT");
    assert.equal(body.generationConfig.responseSchema.properties.tags.type, "ARRAY");
    assert.deepEqual(body.generationConfig.responseSchema.properties.category.enum, ["Education & Learning", "Technology", "Food & Cooking", "Finance", "Travel", "Health & Fitness", "Work & Career", "Entertainment", "Shopping", "Personal", "Ideas & Inspiration", "Other"]);
    assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], "test-key");
    return response({ title: "Budget", summary: "Monthly budget", category: "Finance", confidence: 0.8, tags: ["budget"], entities: [], possibleIntents: [], possibleActions: [] });
  };
  const result = await geminiAI.analyze({ memory: { title: "Budget", summary: null, category: null, tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: "Monthly budget", possibleIntents: [], possibleActions: [], analysisStatus: "partial", confidence: null, evidenceSources: [], analysisMetadata: null, id: "1", userId: "u", createdAt: "", updatedAt: "" }, evidence: [] });
  assert.equal(result.memory.category, "Finance");
});

test("Gemini life parsing sends an object response schema and rejects arrays", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.generationConfig.responseSchema.type, "OBJECT");
    assert.equal(body.generationConfig.responseSchema.properties.type.type, "STRING");
    return response({ type: "event", title: "Exam", description: "Exam Friday", confidence: 0.8 });
  };
  const result = await geminiAI.parseLife({ text: "exam Friday", timezone: "UTC" });
  assert.equal(result.contexts[0].title, "Exam");

  globalThis.fetch = async () => response([{ type: "event", title: "Exam" }]);
  await assert.rejects(() => geminiAI.parseLife({ text: "exam Friday", timezone: "UTC" }));
});

test("Gemini relevance and action requests each send an object schema", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const schemas: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    schemas.push(body.generationConfig.responseSchema);
    if (schemas.length === 1) return response({ relevant: true, confidence: 0.9, reason: "The topics align." });
    return response({ type: "checklist", title: "Review", description: "Review this", payload: {} });
  };
  const memory = { id: "1", userId: "u", title: "Calculus notes", summary: "Calculus", category: "Education & Learning", tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: "Calculus", possibleIntents: [], possibleActions: [], analysisStatus: "complete", confidence: 0.9, evidenceSources: [], analysisMetadata: null, createdAt: "", updatedAt: "" } as never;
  const life = { id: "2", userId: "u", type: "event", title: "Exam", description: "Exam", startDate: null, endDate: null, status: "active", confidence: 0.9, createdAt: "", updatedAt: "" } as never;
  await geminiAI.evaluateRelevance!(memory, life, 0.9);
  await geminiAI.generateAction!("checklist", memory, life);
  assert.equal((schemas[0] as { type: string }).type, "OBJECT");
  assert.equal((schemas[1] as { type: string }).type, "OBJECT");
});

test("Gemini Home agent uses bounded structured planning and visual verification", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const schemas: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    schemas.push(body.generationConfig.responseSchema);
    if (schemas.length === 1) {
      const prompt = body.contents[0].parts[0].text as string;
      assert.match(prompt, /recentTurns/);
      assert.equal(prompt.length < 10_000, true);
      return response({ intent: "SEARCH_MEMORY", tool: "searchMemories", searchQuery: "butterfly cake", requiredConcepts: ["butterfly", "cake"], needsClarification: false, reply: "I’ll check your cake Memories." });
    }
    return response({ matches: false, subject: "cake", requestedAttribute: "butterfly design", evidence: "", confidence: "low" });
  };
  const plan = await geminiAI.interpretHome!({ message: "Yes a butterfly cake", recentTurns: [{ role: "user", text: "A cake I saved" }], currentTopic: "cake", candidateTitles: ["Cake"], rejectedMemoryIds: [], hasPlan: false });
  assert.equal(plan?.intent, "SEARCH_MEMORY");
  const visual = await geminiAI.verifyThumbnailForQuery!({ image: { data: "aW1hZ2U=", mimeType: "image/png" }, query: "butterfly cake", subject: "cake", requestedAttribute: "butterfly design", title: "Cake video" });
  assert.equal(visual?.matches, false);
  assert.equal(schemas[0].type, "OBJECT");
  assert.equal(schemas[0].properties && (schemas[0].properties as Record<string, unknown>).tool !== undefined, true);
  assert.equal(schemas[1].type, "OBJECT");
});

test("Gemini request rejection is classified as provider unavailability", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), { status: 400 });
  await assert.rejects(() => geminiAI.analyze({ memory: {} as never, evidence: [] }), (error: { code?: string }) => error.code === "AI_UNAVAILABLE");
});

test("Gemini malformed response is rejected", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }), { status: 200 });
  await assert.rejects(() => geminiAI.analyze({ memory: {} as never, evidence: [] }));
});

test("Gemini auth and rate-limit failures map to safe integration errors", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  for (const status of [401, 403, 429]) {
    globalThis.fetch = async () => response({}, status);
    await assert.rejects(() => geminiAI.parseLife({ text: "exam next week", timezone: "UTC" }), (error: { code?: string }) => error.code === (status === 429 ? "RATE_LIMITED" : "AI_UNAVAILABLE"));
  }
});

test("Gemini uses the unchanged 2048-dimensional embedding contract", async () => {
  const embedding = await geminiAI.embed("maths");
  assert.equal(embedding.length, 2048);
  assert.ok(embedding.every(Number.isFinite));
  assert.deepEqual(embedding, await geminiAI.embed("maths"));
});
