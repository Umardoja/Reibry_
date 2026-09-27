import assert from "node:assert/strict";
import test from "node:test";
import { DAYPART_DEFAULTS, resolveLifeDateRange, resolveRelativeDate } from "../src/lib/integration/relative-date.ts";

const referenceNow = new Date("2026-09-22T10:00:00.000Z");
const resolve = (value: string, timeZone = "UTC") => resolveRelativeDate({ value, referenceNow, timeZone });

test("resolves relative dayparts from a fixed reference", () => {
  assert.equal(resolve("tomorrow morning").iso, "2026-09-23T09:00:00.000Z");
  assert.equal(resolve("Saturday evening").iso, "2026-09-26T19:00:00.000Z");
  assert.equal(resolve("tonight").iso, "2026-09-22T21:00:00.000Z");
  assert.equal(DAYPART_DEFAULTS.morning, 9);
});

test("resolves explicit times and weekday semantics", () => {
  assert.equal(resolve("Thursday at 2 PM").iso, "2026-09-24T14:00:00.000Z");
  assert.equal(resolve("next Monday").iso, "2026-09-28T00:00:00.000Z");
  assert.equal(resolve("in 3 days").iso, "2026-09-25T00:00:00.000Z");
  assert.equal(resolve("in 2 weeks").iso, "2026-10-06T00:00:00.000Z");
});

test("supports 24-hour clocks and ISO values", () => {
  assert.equal(resolve("tomorrow at 09:30").iso, "2026-09-23T09:30:00.000Z");
  assert.equal(resolve("2026-09-24").iso, "2026-09-24T00:00:00.000Z");
  assert.equal(resolve("2026-09-24T14:00:00", "Africa/Lagos").iso, "2026-09-24T13:00:00.000Z");
  assert.equal(resolve("2026-09-24T14:00:00+01:00").iso, "2026-09-24T13:00:00.000Z");
});

test("converts local times using the supplied IANA timezone", () => {
  assert.equal(resolve("tomorrow at 9 AM", "Africa/Lagos").iso, "2026-09-23T08:00:00.000Z");
  assert.equal(resolve("Thursday at 2 PM", "America/New_York").iso, "2026-09-24T18:00:00.000Z");
  assert.equal(resolve("tomorrow", "Invalid/Zone").iso, "2026-09-23T00:00:00.000Z");
});

test("leaves ambiguous or invalid date language unresolved", () => {
  assert.equal(resolve("sometime later").iso, null);
  assert.equal(resolve("sometime later").resolution, "ambiguous");
  assert.equal(resolve("").iso, null);
});

test("does not persist an end date before the resolved start", () => {
  const range = resolveLifeDateRange({ startValue: "Thursday at 2 PM", endValue: "today", referenceNow, timeZone: "UTC" });
  assert.equal(range.startDate, "2026-09-24T14:00:00.000Z");
  assert.equal(range.endDate, null);
});
