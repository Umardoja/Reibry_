import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "../src/lib/auth/next-destination.ts";

test("auth preserves an explicit shared Capture return destination", () => {
  const destination = "/capture?url=https%3A%2F%2Fexample.com%2Farticle&text=Shared%20note";
  assert.equal(safeNext(destination), destination);
});

test("auth rejects external and browser-normalized external destinations", () => {
  for (const destination of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "javascript:alert(1)"]) {
    assert.equal(safeNext(destination), null);
  }
});

test("auth accepts product routes and treats absent next as optional", () => {
  assert.equal(safeNext("/today"), "/today");
  assert.equal(safeNext("/memories/example"), "/memories/example");
  for (const destination of [undefined, null, ""]) assert.equal(safeNext(destination), null);
});
