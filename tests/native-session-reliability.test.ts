import test from "node:test";
import assert from "node:assert/strict";
import { SessionCoordinator } from "../src/lib/native/session-coordinator.ts";
import type { SessionCredentials, SessionTransport } from "../src/lib/native/session-coordinator.ts";

const user: SessionCredentials = { userId: "owner-a", accessToken: "test-access", refreshToken: "test-refresh", expiresAt: 1800000000 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup(overrides: Partial<SessionTransport> = {}) {
  let vault: SessionCredentials | null = null;
  let writes = 0, clears = 0;
  const transport: SessionTransport = {
    read: async () => user, begin: async () => "ticket", exchange: async session => session,
    write: async session => { vault = session; writes++; },
    clear: async () => { vault = null; clears++; }, unavailable: async () => {}, ...overrides,
  };
  return { coordinator: new SessionCoordinator(transport), transport, snapshot: () => ({ vault, writes, clears }) };
}
test("restored WebView session writes empty native vault before ready", async () => {
  const ack = deferred<void>(); const f = setup({ write: () => ack.promise });
  const pending = f.coordinator.sync();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.coordinator.state, "restoring");
  ack.resolve(); await pending; assert.equal(f.coordinator.state, "authenticated");
});
test("new app coordinator restores existing web auth without a sign-in event", async () => {
  for (let restart = 0; restart < 2; restart++) { const f = setup(); await f.coordinator.sync(); assert.deepEqual(f.snapshot().vault, user); }
});
test("missing vault during pending browser restoration is not unauthenticated", async () => {
  const read = deferred<SessionCredentials | null>(); const f = setup({ read: () => read.promise });
  const pending = f.coordinator.sync(); assert.equal(f.coordinator.state, "restoring"); assert.equal(f.snapshot().clears, 0);
  read.resolve(user); await pending; assert.equal(f.coordinator.state, "authenticated");
});
test("refreshed auth event replaces the entire credential record", async () => {
  const f = setup(); await f.coordinator.sync(); const rotated = { ...user, accessToken: "new-access", refreshToken: "new-refresh", expiresAt: user.expiresAt + 3600 };
  f.transport.read = async () => rotated; await f.coordinator.sync(true); assert.deepEqual(f.snapshot().vault, rotated);
});
test("concurrent startup callers share one vault write", async () => {
  const f = setup(); await Promise.all([f.coordinator.sync(), f.coordinator.sync(), f.coordinator.sync()]); assert.equal(f.snapshot().writes, 1);
});
test("storage rejection leaves web user intact and native readiness false", async () => {
  const f = setup({ write: async () => { throw new Error("Storage unavailable"); } }); await f.coordinator.sync();
  assert.equal(f.coordinator.state, "temporary-error"); assert.equal(f.coordinator.userId, user.userId); assert.equal(f.snapshot().clears, 0);
});
test("temporary exchange failure retries successfully without clearing credentials", async () => {
  const f = setup(); await f.coordinator.sync(); f.transport.exchange = async () => { throw new Error("503"); };
  await f.coordinator.sync(); assert.equal(f.coordinator.state, "temporary-error"); assert.deepEqual(f.snapshot().vault, user);
  f.transport.exchange = async session => session; await f.coordinator.sync(); assert.equal(f.coordinator.state, "authenticated");
});
test("sign-out defeats an in-flight exchange", async () => {
  const response = deferred<SessionCredentials>(); const f = setup({ exchange: () => response.promise });
  const pending = f.coordinator.sync(); await new Promise(resolve => setImmediate(resolve));
  await f.coordinator.clear(); response.resolve(user); await pending;
  assert.equal(f.snapshot().vault, null); assert.equal(f.coordinator.state, "unauthenticated");
});
test("sign-out is ordered after an already-started vault write", async () => {
  const ack = deferred<void>(); let stored = false;
  const f = setup({ write: async () => { await ack.promise; stored = true; }, clear: async () => { stored = false; } });
  const sync = f.coordinator.sync(); await new Promise(resolve => setImmediate(resolve));
  const clear = f.coordinator.clear(); ack.resolve(); await Promise.all([sync, clear]); assert.equal(stored, false);
});
test("account switch discards the previous account's delayed response", async () => {
  const response = deferred<SessionCredentials>(); const f = setup({ exchange: () => response.promise });
  const first = f.coordinator.sync(); await new Promise(resolve => setImmediate(resolve));
  const second = { ...user, userId: "owner-b", accessToken: "b-access", refreshToken: "b-refresh" };
  f.transport.read = async () => second; f.transport.exchange = async session => session;
  await f.coordinator.sync(true); response.resolve(user); await first; assert.deepEqual(f.snapshot().vault, second);
});
test("session exchange for an unexpected account cannot become ready", async () => {
  const f = setup({ exchange: async () => ({ ...user, userId: "different" }) }); await f.coordinator.sync();
  assert.equal(f.snapshot().writes, 0); assert.equal(f.coordinator.state, "temporary-error");
});
test("confirmed browser logout clears old native credentials", async () => {
  const f = setup(); await f.coordinator.sync(); f.transport.read = async () => null; await f.coordinator.sync();
  assert.equal(f.snapshot().vault, null); assert.equal(f.coordinator.state, "unauthenticated");
});
