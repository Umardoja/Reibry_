import test from "node:test";
import assert from "node:assert/strict";
import { captureDedupeKey, normalizeCaptureText, normalizeCaptureUrl } from "../src/lib/integration/dedupe.ts";

test("URL dedupe removes tracking parameters, fragments, and safe trailing slashes", () => {
  assert.equal(normalizeCaptureUrl(" HTTPS://Example.COM/video/?id=12&utm_source=tiktok#comments "), "https://example.com/video?id=12");
  assert.equal(captureDedupeKey({ sourceUrl: "https://example.com/video?id=12&utm_source=tiktok" }), captureDedupeKey({ sourceUrl: "https://example.com/video?id=12" }));
});

test("text dedupe collapses whitespace and case without fuzzy matching", () => {
  assert.equal(normalizeCaptureText("  Red Velvet   Cake Tutorial  "), "red velvet cake tutorial");
  assert.equal(captureDedupeKey({ rawText: "Red Velvet Cake Tutorial" }), captureDedupeKey({ rawText: " red velvet   cake tutorial " }));
  assert.notEqual(captureDedupeKey({ rawText: "Red Velvet Cake Tutorial" }), captureDedupeKey({ rawText: "Red Velvet Cake Tutorial for Mum's birthday" }));
});

test("the same source key is deterministic and scoped by the caller's Store", () => {
  assert.equal(captureDedupeKey({ sourceUrl: "https://example.com/a" }).length, 64);
  assert.notEqual(captureDedupeKey({ sourceUrl: "https://example.com/a" }), captureDedupeKey({ sourceUrl: "https://example.com/b" }));
});
