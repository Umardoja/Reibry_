import assert from "node:assert/strict";
import test from "node:test";
import { memorySearchFilter, searchTerms } from "../src/lib/data/search-terms.ts";

test("contraction-only search terms produce no database filter instead of an empty OR expression", async () => {
  assert.deepEqual(searchTerms("I'm"), []);
  assert.equal(memorySearchFilter("I'm"), null);
  assert.equal(memorySearchFilter("!!!"), null);
  assert.match(memorySearchFilter("orange juice") ?? "", /title\.ilike\.%orange%/);
});
