import test from "node:test";
import assert from "node:assert/strict";
import { canonicalConcept, conceptScore, semanticConcepts } from "../src/lib/retrieval/concepts.ts";

test("semantic concepts normalize safe singular/plural forms", () => {
  assert.equal(canonicalConcept("oranges"), "orange");
  assert.equal(canonicalConcept("cakes"), "cake");
  assert.ok(conceptScore("oranges", [{ text: "Fresh orange juice recipe", source: "title" }]) > 0);
});

test("direct food relationships are searchable without making unrelated concepts match", () => {
  assert.ok(conceptScore("orange drink", [{ text: "Fresh orange juice recipe", source: "title" }]) > 0.3);
  assert.ok(conceptScore("banana", [{ text: "Banana pie recipe", source: "title" }]) > 0.3);
  assert.equal(conceptScore("banana smoothie", [{ text: "Fresh orange juice recipe", source: "title" }]), 0);
});

test("semantic evidence index is bounded and provenance-aware", () => {
  const concepts = semanticConcepts([{ text: "Butterfly-shaped cake decoration", source: "thumbnail" }]);
  assert.ok(concepts.some((entry) => entry.concept === "cake" && entry.source === "thumbnail"));
  assert.ok(concepts.length <= 32);
});

test("admin migration uses role-based authorization and no content browsing", async () => {
  const sql = await import("node:fs/promises").then((fs) => fs.readFile("supabase/migrations/20260923000000_admin_analytics.sql", "utf8"));
  assert.match(sql, /role text not null default 'user'/);
  assert.match(sql, /analytics_events/);
  assert.doesNotMatch(sql, /select .*raw_text/i);
});
