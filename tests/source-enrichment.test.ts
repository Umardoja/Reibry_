import assert from "node:assert/strict";
import test from "node:test";
import { deriveTags, enrichCapture, isSafePublicUrl, normalizeCategory } from "../src/lib/sources/enrichment.ts";
import { normalizeCapture } from "../src/lib/sources/adapters.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("canonical categories normalize synonyms and reject arbitrary values", () => {
  assert.equal(normalizeCategory("Education"), "Education & Learning");
  assert.equal(normalizeCategory("Programming"), "Technology");
  assert.equal(normalizeCategory("made up category"), "Other");
});

test("tags come from source concepts and significant evidence words", () => {
  assert.deepEqual(deriveTags("Solving calculus and algebraic equations efficiently"), ["mathematics", "education", "solving", "calculus", "algebraic", "equations", "efficiently"]);
  assert.equal(deriveTags("the and for").length, 0);
});

test("public URL checks reject internal and unsupported targets", () => {
  assert.equal(isSafePublicUrl("https://example.com/article"), true);
  assert.equal(isSafePublicUrl("http://127.0.0.1/private"), false);
  assert.equal(isSafePublicUrl("http://192.168.1.4/private"), false);
  assert.equal(isSafePublicUrl("file:///tmp/private"), false);
});

test("YouTube enrichment uses oEmbed metadata without downloading video", async () => {
  globalThis.fetch = async (input) => {
    assert.match(String(input), /youtube\.com\/oembed/);
    return new Response(JSON.stringify({ title: "Negotiating for a Rolex", author_name: "Public Channel", thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await enrichCapture({ sourceType: "social_post", sourceUrl: "https://youtu.be/example", rawText: "Watch this negotiation", evidence: [{ platform: "youtube", mediaUrl: "https://youtu.be/example", sourceQuality: "low" }] });
  assert.equal(result.sourceType, "video");
  assert.equal(result.title, "Negotiating for a Rolex");
  assert.equal(result.evidence[0].author, "Public Channel");
  assert.equal(result.evidence[0].metadataSource, "youtube-oembed");
});

test("generic HTML metadata is bounded and merged with shared evidence", async () => {
  globalThis.fetch = async () => new Response("<html><head><title>Public Article</title><meta property='og:description' content='A useful public description'><meta property='og:image' content='https://example.com/image.jpg'></head></html>", { status: 200, headers: { "content-type": "text/html" } });
  const result = await normalizeCapture({ sourceType: "link", sourceUrl: "https://example.com/article", rawText: "Shared caption" });
  assert.equal(result.title, "Public Article");
  assert.equal(result.evidence[0].caption, "A useful public description");
  assert.equal(result.evidence[0].metadataSource, "web-metadata");
});

test("metadata timeout/failure preserves the original capture evidence", async () => {
  globalThis.fetch = async () => { throw new Error("timeout"); };
  const result = await normalizeCapture({ sourceType: "link", sourceUrl: "https://example.com/slow", rawText: "Shared text" });
  assert.equal(result.sourceUrl, "https://example.com/slow");
  assert.equal(result.rawText, "Shared text");
  assert.equal(result.evidence[0].caption, "Shared text");
});

test("URL-only raw text is detected as a link before enrichment", async () => {
  globalThis.fetch = async () => new Response("<html><head><title>Public Guide</title></head></html>", { status: 200, headers: { "content-type": "text/html" } });
  const result = await normalizeCapture({ sourceType: "text", rawText: "https://example.com/guide" });
  assert.equal(result.sourceType, "link");
  assert.equal(result.sourceUrl, "https://example.com/guide");
  assert.equal(result.rawText, undefined);
  assert.equal(result.title, "Public Guide");
});

test("a source URL wins over a text source-type hint", async () => {
  globalThis.fetch = async () => new Response("<html><head><title>Linked Note</title></head></html>", { status: 200, headers: { "content-type": "text/html" } });
  const result = await normalizeCapture({ sourceType: "text", sourceUrl: "https://example.com/linked" });
  assert.equal(result.sourceType, "link");
  assert.equal(result.sourceUrl, "https://example.com/linked");
});

test("YouTube watch, Shorts, and short URLs use the same public oEmbed path", async () => {
  const seen: string[] = [];
  globalThis.fetch = async (input) => { seen.push(String(input)); return new Response(JSON.stringify({ title: "Public Video", author_name: "Channel", thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg" }), { status: 200, headers: { "content-type": "application/json" } }); };
  for (const url of ["https://www.youtube.com/watch?v=abc", "https://www.youtube.com/shorts/abc", "https://youtu.be/abc"]) {
    const result = await normalizeCapture({ sourceType: "link", sourceUrl: url });
    assert.equal(result.sourceType, "video");
    assert.equal(result.evidence[0].platform, "youtube");
    assert.equal(result.evidence[0].metadataSource, "youtube-oembed");
  }
  assert.equal(seen.length, 3);
  assert.ok(seen.every((url) => url.includes("youtube.com/oembed")));
});

test("enrichment failure keeps a valid URL capture usable", async () => {
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  const result = await normalizeCapture({ sourceType: "link", sourceUrl: "https://example.com/unavailable" });
  assert.equal(result.sourceUrl, "https://example.com/unavailable");
  assert.equal(result.evidence[0].mediaUrl, "https://example.com/unavailable");
});
