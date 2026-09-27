import assert from "node:assert/strict";
import test from "node:test";
import { nvidiaAI } from "../src/lib/ai/nvidia/service.ts";
import { IntegrationError } from "../src/lib/integration/errors.ts";
import type { Memory } from "../src/types/reibry.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.NVIDIA_API_KEY;
const originalTimeout = process.env.NVIDIA_STRUCTURED_TIMEOUT_MS;

const memory: Memory = {
  id: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  title: "Supplied evidence",
  summary: null,
  category: null,
  tags: [],
  entities: [],
  sourceUrl: null,
  sourcePlatform: null,
  sourceType: "text",
  rawText: null,
  possibleIntents: [],
  possibleActions: [],
  analysisStatus: "processing",
  confidence: null,
  evidenceSources: [],
  analysisMetadata: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function setup(response: unknown = { title: "Analyzed evidence", summary: "Grounded result", confidence: 0.8, tags: [], entities: [], possibleIntents: [], possibleActions: [] }) {
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_STRUCTURED_TIMEOUT_MS = "5000";
  const requests: { body: Record<string, unknown>; count: number } = { body: {}, count: 0 };
  globalThis.fetch = async (_input, init) => {
    requests.count += 1;
    requests.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }), { status: 200 });
  };
  return requests;
}

function restore() {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
  else process.env.NVIDIA_API_KEY = originalKey;
  if (originalTimeout === undefined) delete process.env.NVIDIA_STRUCTURED_TIMEOUT_MS;
  else process.env.NVIDIA_STRUCTURED_TIMEOUT_MS = originalTimeout;
}

test("text-only evidence selects the existing text provider", async () => {
  const requests = setup();
  try {
    const result = await nvidiaAI.analyze({ memory, evidence: [{ caption: "A birthday cake recipe", modality: "text" }] });
    assert.equal(requests.body.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
    assert.equal(typeof (requests.body.messages as { content: unknown }[])[1].content, "string");
    assert.equal(result.metadata.provider, "nvidia");
  } finally { restore(); }
});

test("image evidence selects NVIDIA Omni", async () => {
  const requests = setup();
  try {
    const result = await nvidiaAI.analyze({ memory, evidence: [{ thumbnail: "https://cdn.example.com/cake.jpg", caption: "Cake", modality: "image" }] });
    const content = (requests.body.messages as { content: unknown }[])[1].content as { type: string }[];
    assert.equal(requests.body.model, "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
    assert.equal(content.some((part) => part.type === "image_url"), true);
    assert.equal(result.metadata.evidenceSources[0].modality, "image");
  } finally { restore(); }
});

test("frames, video, and audio evidence select NVIDIA Omni", async () => {
  for (const evidence of [
    [{ frames: [{ timestampSeconds: 1, imageUrl: "https://cdn.example.com/frame.png" }], transcript: "Mix the batter.", modality: "video" as const }],
    [{ mediaUrl: "https://cdn.example.com/clip.mp4", mimeType: "video/mp4", durationSeconds: 30, modality: "video" as const }],
    [{ mediaUrl: "https://cdn.example.com/voice.mp3", mimeType: "audio/mpeg", transcript: "Add flour.", modality: "audio" as const }],
  ]) {
    const requests = setup();
    try {
      await nvidiaAI.analyze({ memory, evidence });
      const content = (requests.body.messages as { content: unknown }[])[1].content as { type: string }[];
      assert.equal(requests.body.model, "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
      assert.equal(content.some((part) => ["image_url", "video_url", "audio_url"].includes(part.type)), true);
    } finally { restore(); }
  }
});

test("transcript is preserved in multimodal evidence fusion", async () => {
  const requests = setup();
  try {
    await nvidiaAI.analyze({ memory, evidence: [{ mediaUrl: "https://cdn.example.com/clip.mp4", transcript: "The speaker explains the frosting.", modality: "video" }] });
    const content = (requests.body.messages as { content: { text?: string }[] }[])[1].content;
    assert.equal(content[0].text?.includes("The speaker explains the frosting."), true);
  } finally { restore(); }
});

test("metadata-only evidence uses text analysis", async () => {
  const requests = setup();
  try {
    const result = await nvidiaAI.analyze({ memory, evidence: [{ title: "Birthday recipe", platform: "youtube", modality: "metadata" }] });
    assert.equal(requests.body.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
    assert.equal(result.metadata.provider, "nvidia");
  } finally { restore(); }
});

test("multimodal failure falls back to text evidence with partial confidence", async () => {
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_STRUCTURED_TIMEOUT_MS = "5000";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls <= 2) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: "Fallback", confidence: 0.9, tags: [], entities: [], possibleIntents: [], possibleActions: [] }) } }] }), { status: 200 });
  };
  try {
    const result = await nvidiaAI.analyze({ memory, evidence: [{ thumbnail: "https://cdn.example.com/cake.jpg", caption: "A cake recipe", modality: "image" }] });
    assert.equal(result.metadata.status, "partial");
    assert.equal(result.metadata.confidence, 0.5);
    assert.equal(result.metadata.warnings.some((warning) => warning.includes("fallback")), true);
  } finally { restore(); }
});

test("no useful evidence fails without asking NVIDIA to invent content", async () => {
  const requests = setup();
  try {
    const result = await nvidiaAI.analyze({ memory, evidence: [{}] });
    assert.equal(result.metadata.status, "partial");
    assert.equal(result.metadata.confidence, null);
    assert.equal(requests.count, 0);
  } finally { restore(); }
});

test("unsupported, private, and excessive media are rejected", async () => {
  for (const evidence of [
    [{ mediaUrl: "https://cdn.example.com/file.pdf", modality: "image" as const }],
    [{ thumbnail: "http://127.0.0.1/cake.jpg", modality: "image" as const }],
    [{ frames: Array.from({ length: 9 }, (_, index) => ({ timestampSeconds: index, imageUrl: "https://cdn.example.com/frame.png" })) }],
  ]) {
    setup();
    try {
      await assert.rejects(() => nvidiaAI.analyze({ memory, evidence }), (error: unknown) => error instanceof IntegrationError && error.code === "SOURCE_UNAVAILABLE");
    } finally { restore(); }
  }
});