import test from "node:test";
import assert from "node:assert/strict";
import { isSafeThumbnailUrl } from "../src/lib/intelligence/thumbnail-policy.ts";
import { geminiAI } from "../src/lib/integration/gemini.ts";
import { mergeThumbnailEvidence } from "../src/lib/intelligence/visual-evidence.ts";

test("thumbnail URL policy accepts HTTPS previews and rejects private or non-image targets", () => {
  assert.equal(isSafeThumbnailUrl("https://cdn.example.com/preview.jpg"), true);
  assert.equal(isSafeThumbnailUrl("http://cdn.example.com/preview.jpg"), false);
  assert.equal(isSafeThumbnailUrl("https://127.0.0.1/preview.jpg"), false);
  assert.equal(isSafeThumbnailUrl("https://localhost/preview.jpg"), false);
});

test("Gemini thumbnail analysis sends image bytes with a bounded structured contract", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let requestBody: { contents: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>; generationConfig: { responseSchema: { type: string } } } | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ description: "A decorated heart-shaped cake.", primaryObjects: ["cake"], visualConcepts: ["heart-shaped cake"], attributes: ["heart-shaped"], relationships: ["cake is shaped like a heart"], activities: ["cake decorating"], visibleText: [], confidence: "high" }) }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await geminiAI.analyzeThumbnail!({ image: { data: "aW1hZ2U=", mimeType: "image/jpeg" }, caption: "Made this today", platform: "tiktok" });
    assert.equal(result?.confidence, "high");
    assert.deepEqual(result?.relationships, ["cake is shaped like a heart"]);
    const captured = requestBody!;
    const parts = captured.contents[0].parts;
    assert.ok(parts[1]?.inlineData);
    assert.equal(parts[1].inlineData.mimeType, "image/jpeg");
    assert.equal(parts[1].inlineData.data, "aW1hZ2U=");
    assert.equal(captured.generationConfig.responseSchema.type, "OBJECT");
    assert.match(JSON.stringify(captured.generationConfig.responseSchema), /relationships/);
    assert.match(JSON.stringify(captured.contents[0].parts[0]), /object-to-object relationships/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  }
});

test("thumbnail relationship evidence persists with thumbnail provenance and bounded concepts", () => {
  const merged = mergeThumbnailEvidence({ status: "complete", confidence: 0.9, warnings: [], evidenceSources: [], semanticConcepts: [{ concept: "cake", source: "title", strength: "exact" }] }, {
    description: "A decorated cake is designed to resemble a chef apron.", primaryObjects: ["cake"], visualConcepts: ["apron-shaped cake", "chef apron cake", "decorated cake"], attributes: ["white decorated cake"], relationships: ["cake is designed to resemble a chef apron"], activities: [], visibleText: [], confidence: "high",
  });
  assert.deepEqual(merged.visualEvidence?.relationships, ["cake is designed to resemble a chef apron"]);
  assert.ok(merged.semanticConcepts?.some((item) => item.concept === "apron-shaped cake" && item.source === "thumbnail" && item.strength === "direct"));
  assert.ok(!merged.semanticConcepts?.some((item) => item.concept === "apron-shaped cake" && item.source === "title"));
  assert.equal(merged.visualEvidence?.concepts.length, 4);
});
