import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountDestination, signupError, isUnauthenticated } from "../src/lib/auth/account-policy.ts";
const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("temporary session failures do not declare a signed-in user signed out", () => {
  assert.equal(isUnauthenticated({ status: 503 }), false);
  assert.equal(isUnauthenticated({ status: 429 }), false);
  assert.equal(isUnauthenticated({ name: "AuthRetryableFetchError" }), false);
  assert.equal(isUnauthenticated({ name: "AuthSessionMissingError" }), true);
  assert.equal(isUnauthenticated({ status: 401 }), true);
});
test("existing account bypasses onboarding independent of local storage", () => assert.equal(accountDestination(null, "2026-09-22T12:00:00Z"), "/today"));
test("new account with incomplete profile enters onboarding", () => assert.equal(accountDestination(null, null), "/onboarding"));
test("safe share and Memory destinations beat onboarding", () => {
  for (const next of ["/capture?share=abc", "/memories/11111111-1111-4111-8111-111111111111"]) assert.equal(accountDestination(next, null), next);
});
test("external next cannot escape account routing", () => assert.equal(accountDestination("//evil.test", null), "/onboarding"));
test("confirmed email rate-limit failure keeps actionable safe classification", () => {
  assert.equal(signupError("over_email_send_rate_limit", 429).code, "EMAIL_RATE_LIMIT");
  assert.equal(signupError("over_request_rate_limit", 429).status, 429);
});
test("duplicate email, password and invalid-email errors are distinct", () => {
  assert.equal(signupError("user_already_exists").code, "EMAIL_EXISTS");
  assert.equal(signupError("weak_password").code, "WEAK_PASSWORD");
  assert.equal(signupError("email_address_invalid").code, "INVALID_EMAIL");
});
test("unknown auth error never exposes provider detail", () => {
  assert.equal(signupError("private database detail").code, "AUTH_UNAVAILABLE");
  assert.doesNotMatch(signupError("private database detail").message, /database|private/);
});
test("signup confirmation state returns before protected navigation", () => {
  const code = source("src/app/auth/page.tsx");
  assert.match(code, /mode === "up" && !body.data\?\.session\) \{ setConfirmation\(true\); return;/);
  assert.match(code, /accountDestination\(null, profile.data.onboardingCompletedAt\)/);
});
test("Skip and Finish persist completion rather than setting local storage", () => {
  const code = source("src/app/onboarding/page.tsx");
  assert.match(code, /fetch\("\/api\/account", \{ method: "POST"/);
  assert.doesNotMatch(code, /localStorage/);
  assert.ok((code.match(/onClick=\{finish\}/g) || []).length >= 3);
});
test("onboarding backfills old accounts without a default for future users", () => {
  const sql = source("supabase/migrations/20260922000000_account_onboarding.sql");
  assert.match(sql, /insert into public.profiles \(user_id\) select id from auth.users/);
  assert.match(sql, /update public.profiles set onboarding_completed_at = now\(\)/);
  assert.doesNotMatch(sql, /onboarding_completed_at[^;]*default now/i);
  assert.match(sql, /after insert on auth.users/);
});
test("optional notification onboarding cannot require permission to finish", () => {
  const code = source("src/app/onboarding/page.tsx");
  assert.match(code, /Stay in the moment/); assert.match(code, /onClick=\{finish\}>Not now/);
  assert.doesNotMatch(code, /permission === "granted"/);
});
test("persistent auth provider restores native session before checking the cookie session", () => {
  const provider = source("src/components/auth/auth-session-provider.tsx");
  assert.match(provider, /syncNativeSession\(\).then\(\(\) => fetch\("\/api\/auth\/session"/);
  assert.match(source("src/app/layout.tsx"), /<AuthSessionProvider>/);
  assert.doesNotMatch(source("src/components/auth/require-auth.tsx"), /fetch\("\/api\/auth\/session"/);
});
test("native bridge observes restored, refreshed and signed-out auth events", () => {
  const code = source("src/components/native/android-session.tsx");
  for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "SIGNED_OUT"]) assert.ok(code.includes(event));
  assert.match(code, /clearNativeSession\(\)/); assert.match(code, /subscription.unsubscribe/);
});
test("account menu exposes real Settings and shared sign-out control", () => {
  assert.match(source("src/components/layout/app-shell.tsx"), /href="\/settings"/);
  assert.match(source("src/app/settings/page.tsx"), /<RequireAuth>/);
  assert.match(source("src/components/auth/sign-out-button.tsx"), /\/api\/auth\/sign-out/);
});
test("notification settings refresh on app focus and expose native settings", () => {
  const code = source("src/components/pwa/notification-control.tsx");
  assert.match(code, /visibilitychange/); assert.match(code, /openNotificationSettings/); assert.match(code, /"Blocked"/);
});
