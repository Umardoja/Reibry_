import assert from "node:assert/strict";
import test from "node:test";
import { rankResurfacedMemories, MAX_SURFACED_ITEMS } from "../src/lib/integration/today-ranking.ts";
import type { ContextMatch, LifeContext, Memory } from "../src/types/reibry.ts";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const date = "2026-01-01T00:00:00.000Z";
function memory(id: string, status: Memory["analysisStatus"] = "complete"): Memory { return { id, userId, title: id, summary: id, category: "Other", tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: id, possibleIntents: [], possibleActions: [], analysisStatus: status, confidence: 0.8, evidenceSources: [], analysisMetadata: null, createdAt: date, updatedAt: date }; }
function life(id: string): LifeContext { return { id, userId, type: "event", title: id, description: null, startDate: null, endDate: null, status: "active", confidence: 0.8, createdAt: date, updatedAt: date }; }
function match(id: string, memoryId: string, lifeContextId: string, similarity: number, status: ContextMatch["status"] = "accepted"): ContextMatch { return { id, userId, memoryId, lifeContextId, similarity, confidence: 0.9, reason: "Relevant now", suggestedAction: null, status, createdAt: date, updatedAt: date }; }

test("Today ranks, deduplicates, and caps resurfaced memories at three", () => {
  const contexts = [life("life-1"), life("life-2")];
  const memories = [memory("memory-1"), memory("memory-2"), memory("memory-3"), memory("memory-4"), memory("failed", "failed")];
  const matches = [match("m1", "memory-1", "life-1", 0.99), match("m1-duplicate", "memory-1", "life-2", 0.98), match("m2", "memory-2", "life-1", 0.9), match("m3", "memory-3", "life-1", 0.8), match("m4", "memory-4", "life-1", 0.7), match("dismissed", "failed", "life-1", 1, "dismissed")];
  const result = rankResurfacedMemories(matches, contexts, memories);
  assert.equal(MAX_SURFACED_ITEMS, 3);
  assert.deepEqual(result.map((item) => item.memory.id), ["memory-1", "memory-2", "memory-3"]);
  assert.ok(result.every((item) => item.reason === "Relevant now"));
});

test("Today excludes processing and failed memories while retaining useful partial memories", () => {
  const contexts = [life("life")];
  const memories = [memory("processing", "processing"), memory("failed", "failed"), memory("partial", "partial")];
  const matches = [match("processing-match", "processing", "life", 1), match("failed-match", "failed", "life", 0.99), match("partial-match", "partial", "life", 0.5)];
  assert.deepEqual(rankResurfacedMemories(matches, contexts, memories).map((item) => item.memory.id), ["partial"]);
});
