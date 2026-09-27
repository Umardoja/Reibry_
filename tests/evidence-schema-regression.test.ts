import assert from "node:assert/strict";
import test from "node:test";
import { memoryRecord, sourceEvidence } from "../src/lib/integration/schemas.ts";

const ids = { id: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" };
const enrichedEvidence = { modality: "metadata" as const, title: "Public article", metadataSource: "web-metadata" };

function record(overrides: Record<string, unknown> = {}) {
  return { ...ids, title: "Saved memory", summary: null, category: "Other", tags: [], entities: [], sourceUrl: null, sourcePlatform: null, sourceType: "text", rawText: "Saved memory", possibleIntents: [], possibleActions: [], analysisStatus: "partial", confidence: null, evidenceSources: [], analysisMetadata: null, ...overrides };
}

test("persisted enriched evidence decodes at the Memory boundary", () => {
  const parsed = memoryRecord.parse(record({ evidenceSources: [enrichedEvidence] }));
  assert.equal(parsed.evidenceSources[0].metadataSource, "web-metadata");
});

test("nested analysisMetadata reuses the canonical evidence schema", () => {
  const parsed = memoryRecord.parse(record({ analysisMetadata: { status: "partial", confidence: null, warnings: [], evidenceSources: [enrichedEvidence] } }));
  assert.equal(parsed.analysisMetadata?.evidenceSources[0].metadataSource, "web-metadata");
  assert.deepEqual(sourceEvidence.parse(enrichedEvidence), enrichedEvidence);
});

test("legacy evidence without metadataSource remains compatible", () => {
  const parsed = memoryRecord.parse(record({ evidenceSources: [{ modality: "text", caption: "Older row" }] }));
  assert.equal(parsed.evidenceSources[0].metadataSource, undefined);
});

test("a Today-compatible Memory with enriched evidence decodes successfully", () => {
  const parsed = memoryRecord.parse(record({ evidenceSources: [enrichedEvidence], analysisMetadata: { status: "complete", confidence: 0.8, warnings: [], evidenceSources: [enrichedEvidence] } }));
  assert.equal(parsed.analysisMetadata?.evidenceSources[0].metadataSource, "web-metadata");
  assert.equal(parsed.analysisStatus, "partial");
});
