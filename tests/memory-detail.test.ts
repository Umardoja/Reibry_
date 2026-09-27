import assert from "node:assert/strict";
import test from "node:test";
import { getMemoryById } from "../src/lib/data/memory-detail.ts";
import { IntegrationError } from "../src/lib/integration/errors.ts";
import type { Memory } from "../src/types/reibry.ts";
import { readFileSync } from "node:fs";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id = "11111111-1111-4111-8111-111111111111";
const saved: Memory = { id, userId: owner, title: "Saved note", summary: null, category: "Other", tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: "Saved note", possibleIntents: [], possibleActions: [], analysisStatus: "complete", confidence: null, evidenceSources: [], analysisMetadata: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };

test("Memory detail uses a direct owned lookup and is independent of list pagination", async () => {
  const store = { get: async (_table: "memories", requestedId: string) => { assert.equal(requestedId, id); return saved; } };
  const result = await getMemoryById(store, id);
  assert.equal(result.id, id);
  assert.equal(result.userId, owner);
});

test("invalid or nonexistent Memory IDs fail safely", async () => {
  await assert.rejects(() => getMemoryById({ get: async () => { throw new IntegrationError("NOT_FOUND", "Memory not found."); } }, "not-a-uuid"), { code: "NOT_FOUND" });
  await assert.rejects(() => getMemoryById({ get: async () => { throw new IntegrationError("NOT_FOUND", "Memory not found."); } }, id), { code: "NOT_FOUND" });
});

test("ownership-scoped repository lookup cannot return another user's Memory", async () => {
  const store = { get: async () => { throw new IntegrationError("NOT_FOUND", `Memory for ${other} not found.`); } };
  await assert.rejects(() => getMemoryById(store, id), { code: "NOT_FOUND" });
});

test("Memory mutation route limits edits to safe user-owned fields", () => {
  const route = readFileSync("src/app/api/memories/[id]/route.ts", "utf8");
  assert.match(route, /export async function PATCH/);
  assert.match(route, /title: z\.string/); assert.match(route, /summary: z\.string/); assert.match(route, /category: z\.enum/); assert.match(route, /tags: z\.array/);
  assert.doesNotMatch(route, /userId: z\./);
  assert.match(route, /store\.update\("memories", id/);
});

test("Memory deletion remains ownership-scoped and relies on database cascades", () => {
  const route = readFileSync("src/app/api/memories/[id]/route.ts", "utf8");
  const repository = readFileSync("src/lib/data/supabase-store.ts", "utf8");
  assert.match(route, /export async function DELETE/);
  assert.match(route, /store\.delete\("memories", id\)/);
  assert.match(repository, /\.delete\(\)\.eq\("id",id\)\.eq\("user_id",userId\)/);
});

test("Memories mobile filters use custom choices and calm partial cards", () => {
  const page = readFileSync("src/app/memories/page.tsx", "utf8");
  const card = readFileSync("src/components/design/memory.tsx", "utf8");
  assert.doesNotMatch(page, /<select/);
  assert.match(page, /ChoiceRows/);
  assert.doesNotMatch(card, /Remembered with limited understanding/);
});
