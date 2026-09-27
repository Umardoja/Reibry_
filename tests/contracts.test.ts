import assert from "node:assert/strict";
import test from "node:test";
import { captureSchema, analyzeSchema, searchSchema, parseLifeSchema, matchSchema, actionSchema } from "../src/lib/api/contracts.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";
test("capture requires content and rejects unsafe URLs and caller-supplied ownership", () => {
  assert.equal(captureSchema.safeParse({ sourceType: "text" }).success, false);
  assert.equal(captureSchema.safeParse({ sourceType: "link", sourceUrl: "javascript:alert(1)" }).success, false);
  assert.equal(captureSchema.safeParse({ sourceType: "text", rawText: "note", userId: id }).success, false);
  assert.equal(captureSchema.safeParse({ sourceType: "text", rawText: "note" }).success, true);
});
test("search enforces bounds and defaults", () => {
  assert.equal(searchSchema.parse({ query: "recipe" }).limit, 10);
  for (const limit of [0, 51, 1.5]) assert.equal(searchSchema.safeParse({ query: "recipe", limit }).success, false);
  assert.equal(searchSchema.safeParse({ query: " " }).success, false);
});
test("identifiers and contextual action inputs are validated", () => {
  assert.equal(analyzeSchema.safeParse({ memoryId: "wrong" }).success, false);
  assert.equal(matchSchema.safeParse({ lifeContextId: id, memoryIds: [] }).success, false);
  assert.equal(actionSchema.safeParse({ type: "reminder" }).success, false);
  assert.equal(actionSchema.safeParse({ type: "reminder", memoryId: id }).success, true);
});
test("life parsing requires text and a real timezone", () => {
  assert.equal(parseLifeSchema.parse({ text: "Trip tomorrow" }).timezone, "UTC");
  assert.equal(parseLifeSchema.safeParse({ text: "Trip", timezone: "not/a-zone" }).success, false);
  assert.equal(parseLifeSchema.safeParse({ text: "Trip", timezone: "Africa/Lagos" }).success, true);
});
