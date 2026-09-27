import assert from "node:assert/strict";

// Run against a local server started without Supabase variables; never against production.
const origin = "http://localhost:3000";
for (const path of ["/today", "/memories", "/memories/example", "/capture", "/ask", "/life", "/manifest.webmanifest", "/icons/icon.svg"]) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, path);
}
const id = "123e4567-e89b-42d3-a456-426614174000";
const requests = [
  ["/api/capture", { sourceType: "text", rawText: "A note" }],
  ["/api/memory/analyze", { memoryId: id }],
  ["/api/memory/search", { query: "recipe" }],
  ["/api/life/parse", { text: "A trip" }],
  ["/api/context/match", { lifeContextId: id }],
  ["/api/actions", { type: "checklist", memoryId: id }],
];
for (const [path, body] of requests) {
  for (const [payload, status, code] of [
    [JSON.stringify(body), 503, "CONFIGURATION_ERROR"],
    ["{}", 400, "VALIDATION_ERROR"],
    ["{", 400, "INVALID_JSON"],
  ]) {
    const response = await fetch(`${origin}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    assert.equal(response.status, status, path);
    const result = await response.json();
    assert.equal(result.data, null);
    assert.equal(result.error.code, code);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const unsupported = await fetch(`${origin}${path}`, { method: "POST", body: "text" });
  assert.equal(unsupported.status, 415);
}
console.log("Passed: all placeholder pages, PWA assets, and six API validation/configuration boundaries.");
