import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bearerToken } from "../src/lib/auth/bearer.ts";

test("absent bearer preserves cookie authentication", () => assert.equal(bearerToken(null), null));
test("bearer parser accepts bounded access tokens", () => assert.equal(bearerToken("Bearer header.payload.signature"), "header.payload.signature"));
test("malformed bearer fails closed rather than choosing cookie identity", () => {
  for (const header of ["", "Basic abc", "Bearer ", "Bearer abc\n", "Bearer " + "a".repeat(8193)]) assert.throws(() => bearerToken(header));
});
test("native Capture bearer identity is verified by Supabase and user-scoped", () => {
  const code = readFileSync(new URL("../src/lib/auth/capture-identity.ts", import.meta.url), "utf8");
  assert.match(code, /auth.getUser\(token\)/); assert.match(code, /userId: data.user.id/);
  assert.match(code, /persistSession: false/); assert.doesNotMatch(code, /SERVICE_ROLE/);
});
test("native token endpoint requires same origin and only user credentials", () => {
  const code = readFileSync(new URL("../src/app/api/auth/native-session/route.ts", import.meta.url), "utf8");
  assert.match(code, /get\("origin"\) !== new URL\(request.url\).origin/);
  assert.match(code, /"Cache-Control": "no-store"/); assert.match(code, /session.refresh_token/); assert.doesNotMatch(code, /SERVICE_ROLE|GEMINI_API_KEY/);
});
