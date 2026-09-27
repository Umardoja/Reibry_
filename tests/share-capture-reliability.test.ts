import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeOrPreserve, sourcePreservation } from "../src/lib/capture/source-preservation.ts";
import { startSharedCapture, submitCapture, type CaptureResult } from "../src/lib/share/capture.ts";
import { savePendingShare, readPendingShare } from "../src/lib/share/pending.ts";
import { shareNotificationPayload, notifySharedCapture } from "../src/lib/pwa/notifications.ts";

const id = "11111111-1111-4111-8111-111111111111";
const source = { sourceType: "social_post" as const, sourceUrl: "https://www.tiktok.com/@creator/video/123", evidence: [{ platform: "tiktok", title: "A public tutorial", caption: "The original caption", author: "Creator", metadataSource: "tiktok-oembed" }] };
const result = { memory: { id, title: "Original source", analysisStatus: "partial" }, duplicate: false } as CaptureResult;
function storage(): Storage {
  const values = new Map<string, string>();
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: (k) => { values.delete(k); }, clear: () => values.clear(), key: (i) => [...values.keys()][i] ?? null, get length() { return values.size; } };
}
test("TikTok metadata and provider timeout preserve partial source instead of failed analysis", async () => {
  const { result: saved, preserved } = await analyzeOrPreserve(source, async () => { throw new DOMException("Timed out", "TimeoutError"); });
  assert.equal(preserved, true); assert.equal(saved.metadata.status, "partial");
  assert.equal(saved.memory.title, source.evidence[0].title);
  assert.deepEqual(saved.metadata.evidenceSources, source.evidence);
  assert.equal(saved.metadata.provider, "source-preservation");
});
test("text timeout preserves original words as partial without invented facts", async () => {
  const text = "An original thought worth keeping.";
  const { result: saved } = await analyzeOrPreserve({ sourceType: "text", rawText: text, evidence: [{ caption: text }] }, async () => { throw new Error("provider secret must not leak"); });
  assert.equal(saved.memory.summary, text); assert.equal(saved.metadata.status, "partial");
  assert.equal(saved.memory.category, "Other"); assert.deepEqual(saved.memory.entities, []);
  assert.deepEqual(saved.memory.possibleIntents, []); assert.deepEqual(saved.memory.possibleActions, []);
  assert.ok(!JSON.stringify(saved).includes("secret"));
});
test("source title is bounded but evidence remains intact", () => {
  const long = "Long caption ".repeat(100);
  const saved = sourcePreservation({ ...source, evidence: [{ caption: long }] });
  assert.ok(saved.memory.title!.length <= 120); assert.equal(saved.metadata.evidenceSources[0].caption, long);
});
test("successful AI analysis is unchanged", async () => {
  const expected = sourcePreservation(source);
  const actual = await analyzeOrPreserve(source, async () => expected);
  assert.equal(actual.preserved, false); assert.equal(actual.result, expected);
});
test("validated share and auth-return remount use exactly one synchronous claim", async () => {
  const s = storage(); savePendingShare(s, id, { text: "A shared thought" });
  let calls = 0;
  const submit = async () => { calls++; return result; };
  const first = startSharedCapture(s, id, submit);
  assert.equal(startSharedCapture(s, id, submit), first);
  await first; assert.equal(calls, 1); assert.equal(readPendingShare(s, id), null);
});
test("manual capture without pending share never auto-submits", () => {
  assert.equal(startSharedCapture(storage(), null, async () => { throw new Error("must not submit"); }), null);
});
test("consumed share never submits again", async () => {
  const s = storage(); savePendingShare(s, id, { text: "Shared" });
  await startSharedCapture(s, id, async () => result);
  assert.equal(startSharedCapture(s, id, async () => { throw new Error("duplicate"); }), null);
});
test("true persistence failure keeps pending source and requires explicit retry", async () => {
  const s = storage(); savePendingShare(s, id, { text: "Shared" });
  await assert.rejects(startSharedCapture(s, id, async () => { throw new Error("DB unavailable"); })!);
  assert.ok(readPendingShare(s, id)); assert.equal(startSharedCapture(s, id, async () => result), null);
  assert.equal(await startSharedCapture(s, id, async () => result, true), result);
});
test("Remembering and Remembered use the same tag; partial is successful", () => {
  const start = shareNotificationPayload(id, "processing")!;
  const done = shareNotificationPayload(id, "complete", result.memory)!;
  assert.equal(start.title, "Remembering…"); assert.equal(done.title, "Remembered");
  assert.equal(start.options.tag, done.options.tag);
  assert.equal(done.options.data.url, `/memories/${id}`);
});
test("failure notification offers pending share retry without private content", () => {
  const failed = shareNotificationPayload(id, "error")!;
  assert.equal(failed.options.body, "Tap to retry"); assert.equal(failed.options.data.url, `/capture?share=${id}`);
  assert.equal(shareNotificationPayload("../../bad", "complete", result.memory), null);
});
test("shared completion stays on receiver with optional exact Memory link", () => {
  const page = readFileSync(new URL("../src/app/capture/page.tsx", import.meta.url), "utf8");
  const shared = page.slice(page.indexOf("async function rememberShared"), page.indexOf("async function submit"));
  assert.doesNotMatch(shared, /router\.(push|replace)/);
  assert.match(page, /<RequireAuth><CaptureContent/);
  assert.match(page, /href=\{"\/memories\/" \+ savedMemory.id\}/);
});
test("API helper preserves credentials and rejects real persistence failure safely", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.credentials, "same-origin");
      return new Response(JSON.stringify({ error: { message: "private database detail" } }), { status: 503 });
    };
    await assert.rejects(submitCapture("a thought"), { message: "We couldn’t remember this. Please try again." });
  } finally { globalThis.fetch = original; }
});
test("long title presentation clamps with accessible expansion rather than truncating data", () => {
  const component = readFileSync(new URL("../src/components/design/memory-title.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(component, /aria-expanded=\{expanded\}/); assert.match(component, /\{title\}/);
  assert.match(css, /-webkit-line-clamp: 4/); assert.match(css, /overflow-wrap: anywhere/);
});

test("granted notifications emit processing before completion with one stable tag", async () => {
  const originals = ["window", "navigator", "Notification"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const shown: { title: string; tag: string }[] = [];
  try {
    const notification = { permission: "granted" };
    Object.defineProperty(globalThis, "window", { configurable: true, value: { Notification: notification } });
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: notification });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: { register: async () => ({ active: {}, showNotification: async (title: string, options: { tag: string }) => { shown.push({ title, tag: options.tag }); } }) } } });
    await Promise.all([notifySharedCapture(id, "processing"), notifySharedCapture(id, "complete", result.memory)]);
    assert.deepEqual(shown.map((item) => item.title), ["Remembering…", "Remembered"]);
    assert.equal(shown[0].tag, shown[1].tag);
    notification.permission = "default";
    assert.equal(await notifySharedCapture(id, "processing"), false);
    assert.equal(shown.length, 2);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
