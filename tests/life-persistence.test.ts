import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLifeDate } from "../src/lib/integration/life-normalization.ts";
import { resolveRelativeDate } from "../src/lib/integration/relative-date.ts";
import { lifeDraft } from "../src/lib/integration/schemas.ts";

test("Life persistence normalizes ISO dates to timestamptz values", () => {
  assert.equal(normalizeLifeDate("2026-09-24T14:00:00+00:00"), "2026-09-24T14:00:00.000Z");
  assert.equal(normalizeLifeDate("2026-09-24"), "2026-09-24T00:00:00.000Z");
});

test("ambiguous natural-language Life dates remain unresolved", () => {
  assert.equal(resolveRelativeDate({ value: "sometime later", referenceNow: new Date("2026-09-22T10:00:00Z"), timeZone: "UTC" }).iso, null);
  assert.equal(normalizeLifeDate(null), null);
  assert.equal(normalizeLifeDate(undefined), null);
});

test("Life domain contract preserves optional end dates and database enums", () => {
  const parsed = lifeDraft.safeParse({
    type: "deadline",
    title: "Submit hackathon project",
    description: "Submit the project by Saturday evening.",
    startDate: null,
    endDate: null,
    status: "active",
    confidence: 0.9,
  });
  assert.equal(parsed.success, true);
});
