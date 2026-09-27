import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import manifest from "../src/app/manifest.ts";
import { normalizeSharedPayload, capturePayload } from "../src/lib/share/payload.ts";
import { savePendingShare, readPendingShare, completePendingShare } from "../src/lib/share/pending.ts";
import { createSubmissionGate } from "../src/lib/capture/submission.ts";
import { notificationPayload, askNotificationPermission } from "../src/lib/pwa/notifications.ts";

test("manifest registers text/title/url share receiver with stable identity and Android PNG icons", () => {
  const value = manifest();
  assert.equal(value.name, "REIBRY"); assert.equal(value.short_name, "REIBRY");
  assert.equal(value.id, value.start_url);
  assert.deepEqual(value.share_target, { action: "/share-target", method: "GET", enctype: "application/x-www-form-urlencoded", params: { title: "title", text: "text", url: "url" } });
  for (const size of ["192x192", "512x512"]) assert.ok(value.icons?.some((icon) => icon.type === "image/png" && icon.sizes === size));
  assert.ok(value.icons?.some((icon) => icon.purpose === "maskable"));
});
test("share normalization accepts URL in url or embedded in text", () => {
  assert.equal(normalizeSharedPayload({ url: "https://example.com/a" }).url, "https://example.com/a");
  const share = normalizeSharedPayload({ title: "Guide", text: "Read this https://example.com/a" });
  assert.equal(share.url, "https://example.com/a"); assert.equal(share.title, "Guide"); assert.equal(share.text, "Read this https://example.com/a");
});
test("caption plus TikTok URL becomes link Capture rather than ordinary text", () => {
  const body = capturePayload("Watch this useful tutorial https://vm.tiktok.com/ZExample/");
  assert.equal(body.sourceType, "link"); assert.equal(body.sourceUrl, "https://vm.tiktok.com/ZExample/");
  assert.match(body.rawText || "", /useful tutorial/);
});
test("text-only and title-only shares remain usable; unsafe URL schemes are not links", () => {
  assert.deepEqual(capturePayload("A useful idea"), { sourceType: "text", rawText: "A useful idea" });
  assert.equal(normalizeSharedPayload({ title: "A title" }).title, "A title");
  assert.equal(normalizeSharedPayload({ url: "javascript:alert(1)" }).url, undefined);
  assert.equal(normalizeSharedPayload({ url: "https://user:password@example.com" }).url, undefined);
});
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test("pending share survives auth/reload and is acknowledged only once after success", () => {
  const store = storage(); savePendingShare(store, "one", { text: "A note" }, 100);
  assert.equal(readPendingShare(store, "one", 200)?.text, "A note");
  assert.equal(readPendingShare(store, "one", 300)?.text, "A note");
  assert.equal(completePendingShare(store, "one"), true);
  assert.equal(completePendingShare(store, "one"), false);
  assert.equal(readPendingShare(store, "one", 400), null);
});
test("pending shares are isolated and expired content is discarded", () => {
  const store = storage(); savePendingShare(store, "one", { text: "First" }, 0); savePendingShare(store, "two", { text: "Second" }, 0);
  completePendingShare(store, "one"); assert.equal(readPendingShare(store, "two", 1)?.text, "Second");
  assert.equal(readPendingShare(store, "two", 86400001), null);
});
test("synchronous capture lock admits one request and one duplicate navigation", async () => {
  const gate = createSubmissionGate(); let requests = 0; let navigations = 0;
  async function submit() { if (!gate.start()) return; requests++; await Promise.resolve(); if (gate.finish("duplicate")) navigations++; }
  await Promise.all([submit(), submit(), submit()]);
  assert.equal(requests, 1); assert.equal(navigations, 1); assert.equal(gate.finish("complete"), false); assert.equal(gate.start(), false);
});
test("a failed capture unlocks a deliberate retry; partial completion stays locked", () => {
  const gate = createSubmissionGate(); assert.equal(gate.start(), true); gate.fail(); assert.equal(gate.state(), "error");
  assert.equal(gate.start(), true); assert.equal(gate.finish("partial"), true); assert.equal(gate.start(), false);
});
test("notification permission is requested only for default; denied is not prompted again", async () => {
  let prompts = 0;
  const requestPermission = async () => { prompts++; return "granted" as const; };
  assert.equal(await askNotificationPermission(undefined), "unsupported");
  assert.equal(await askNotificationPermission({ permission: "denied", requestPermission }), "denied");
  assert.equal(await askNotificationPermission({ permission: "granted", requestPermission }), "granted");
  assert.equal(prompts, 0);
  assert.equal(await askNotificationPermission({ permission: "default", requestPermission }), "granted"); assert.equal(prompts, 1);
});
test("notification uses only a short title and exact persisted Memory deep-link", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const payload = notificationPayload({ id, title: "A".repeat(200) });
  assert.equal(payload?.options.body.length, 100);
  assert.equal(payload?.options.tag, `reibry-memory-${id}`);
  assert.deepEqual(payload?.options.data, { url: `/memories/${id}`, memoryId: id });
  assert.equal(notificationPayload({ id: "../auth", title: "No" }), null);
});
async function notificationClick(url: string, existing = false) {
  const events: Record<string, (event: unknown) => void> = {};
  const visits: string[] = []; let closed = false; let work: Promise<void> | undefined;
  const client = { url: "https://reibry.vercel.app/today", navigate: async (target: string) => { visits.push(target); return { focus: async () => { visits.push("focus"); } }; } };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { URL, self: {
    location: { origin: "https://reibry.vercel.app" }, addEventListener: (name: string, handler: (e: unknown) => void) => { events[name] = handler; },
    clients: { matchAll: async () => existing ? [client] : [], openWindow: async (target: string) => { visits.push(target); } },
  } });
  assert.equal(events.fetch, undefined, "worker must not intercept API requests");
  events.notificationclick({ notification: { data: { url, memoryId: "11111111-1111-4111-8111-111111111111" }, close: () => { closed = true; } }, waitUntil: (promise: Promise<void>) => { work = promise; } });
  await work; return { visits, closed };
}
test("notificationclick opens exact same-origin Memory or focuses an existing client", async () => {
  const path = "/memories/11111111-1111-4111-8111-111111111111";
  assert.deepEqual((await notificationClick(path)).visits, [`https://reibry.vercel.app${path}`]);
  assert.deepEqual((await notificationClick(path, true)).visits, [`https://reibry.vercel.app${path}`, "focus"]);
});
test("notificationclick rejects external, mismatched and query-bearing destinations", async () => {
  for (const url of ["https://evil.example/memories/11111111-1111-4111-8111-111111111111", "/auth", "/memories/11111111-1111-4111-8111-111111111111?next=evil"]) {
    const result = await notificationClick(url); assert.equal(result.closed, true); assert.equal(result.visits.length, 0);
  }
});
