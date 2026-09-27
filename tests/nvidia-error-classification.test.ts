import assert from "node:assert/strict";
import test from "node:test";
import { nvidiaAI } from "../src/lib/ai/nvidia/service.ts";
import { NvidiaDiagnosticError } from "../src/lib/ai/nvidia/errors.ts";
import { nvidiaRequest } from "../src/lib/ai/nvidia/client.ts";
import { runCheck, runImageCheck } from "../scripts/verify-nvidia-runner.ts";
import type { Memory } from "../src/types/reibry.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.NVIDIA_API_KEY;
const originalTimeout = process.env.NVIDIA_STRUCTURED_TIMEOUT_MS;

const memory: Memory = {
  id: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  title: "Test memory",
  summary: null,
  category: null,
  tags: [],
  entities: [],
  sourceUrl: null,
  sourcePlatform: null,
  sourceType: "text",
  rawText: "A supplied test memory",
  possibleIntents: [],
  possibleActions: [],
  analysisStatus: "processing",
  confidence: null,
  evidenceSources: [],
  analysisMetadata: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function setup(fetchImpl: typeof fetch) {
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_STRUCTURED_TIMEOUT_MS = "5000";
  globalThis.fetch = fetchImpl;
}

function restore() {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
  else process.env.NVIDIA_API_KEY = originalKey;
  if (originalTimeout === undefined) delete process.env.NVIDIA_STRUCTURED_TIMEOUT_MS;
  else process.env.NVIDIA_STRUCTURED_TIMEOUT_MS = originalTimeout;
}

test("memory analysis preserves a provider timeout as TIMEOUT", async () => {
  setup(async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); });
  try {
    await assert.rejects(() => nvidiaAI.analyze({ memory, evidence: [{ caption: "text" }] }), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "TIMEOUT");
  } finally { restore(); }
});

test("provider HTTP failure is not relabeled as response parsing", async () => {
  setup(async () => new Response("unavailable", { status: 503 }));
  try {
    await assert.rejects(() => nvidiaAI.analyze({ memory, evidence: [{ caption: "text" }] }), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "HTTP_ERROR");
  } finally { restore(); }
});

test("malformed JSON is classified as RESPONSE_PARSE_ERROR", async () => {
  setup(async () => new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 }));
  try {
    await assert.rejects(() => nvidiaAI.analyze({ memory, evidence: [{ caption: "text" }] }), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "RESPONSE_PARSE_ERROR");
  } finally { restore(); }
});

test("valid JSON with an invalid schema is classified as SCHEMA_VALIDATION_ERROR", async () => {
  setup(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 42 }) } }] }), { status: 200 }));
  try {
    await assert.rejects(() => nvidiaAI.analyze({ memory, evidence: [{ caption: "text" }] }), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "SCHEMA_VALIDATION_ERROR");
  } finally { restore(); }
});

test("independent verifier checks continue after an earlier failure", async () => {
  const attempted: string[] = [];
  const first = await runCheck("first", async () => { attempted.push("first"); throw new NvidiaDiagnosticError("TIMEOUT", "timed out"); });
  const second = await runCheck("second", async () => { attempted.push("second"); });
  assert.deepEqual(attempted, ["first", "second"]);
  assert.equal(first.category, "TIMEOUT");
  assert.equal(second.status, "PASS");
});

test("image verification preserves primary and fallback causes", async () => {
  const result = await runImageCheck(async () => { throw new NvidiaDiagnosticError("NETWORK_ERROR", "reset", "AI_UNAVAILABLE"); }, async () => { throw new NvidiaDiagnosticError("TIMEOUT", "timed out"); });
  assert.equal(result.status, "FAIL");
  assert.equal(result.primaryCategory, "NETWORK_ERROR");
  assert.equal(result.fallbackCategory, "TIMEOUT");
});

test("ECONNRESET is a retryable NETWORK_ERROR", async () => {
  let calls = 0;
  setup(async () => { calls += 1; throw Object.assign(new Error("socket reset"), { cause: { code: "ECONNRESET" } }); });
  try {
    await assert.rejects(() => nvidiaRequest("/chat/completions", {}, "network-test"), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "NETWORK_ERROR");
    assert.equal(calls, 2);
  } finally { restore(); }
});

test("temporary DNS failure retries once and succeeds", async () => {
  let calls = 0;
  setup(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("temporary DNS failure"), { cause: { code: "EAI_AGAIN", name: "TemporaryNetworkError" } });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  try {
    assert.deepEqual(await nvidiaRequest("/chat/completions", {}, "network-test"), { ok: true });
    assert.equal(calls, 2);
  } finally { restore(); }
});

test("two transient network failures stop after the second attempt", async () => {
  let calls = 0;
  setup(async () => { calls += 1; throw Object.assign(new Error("socket closed"), { cause: { code: "UND_ERR_SOCKET" } }); });
  try {
    await assert.rejects(() => nvidiaRequest("/chat/completions", {}, "network-test"), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "NETWORK_ERROR");
    assert.equal(calls, 2);
  } finally { restore(); }
});

test("timeout, HTTP 500, and authentication retain distinct categories", async () => {
  for (const [response, expected] of [[new Response("", { status: 500 }), "HTTP_ERROR"], [new Response("", { status: 401 }), "AUTH_ERROR"]] as const) {
    setup(async () => response.clone());
    try { await assert.rejects(() => nvidiaRequest("/chat/completions", {}, "category-test"), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === expected); } finally { restore(); }
  }
  setup(async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); });
  try { await assert.rejects(() => nvidiaRequest("/chat/completions", {}, "category-test"), (error: unknown) => error instanceof NvidiaDiagnosticError && error.category === "TIMEOUT"); } finally { restore(); }
});
