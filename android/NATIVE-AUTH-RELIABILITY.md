# Native auth handoff repair

## Reproduced defect

Capacitor 8.5.2 `PluginCall.getLong` only accepts `java.lang.Long`.
JSON expiry seconds such as `1800000000` deserialize as `Integer`. The old
`setSession` therefore rejected the handoff as "Invalid session". The web
helper swallowed that rejection and resolved normally; a signed-in WebView
could have an empty encrypted vault. The worker then declared authentication
required. `NativeSessionReliabilityTest.reproducesCapacitorIntegerExpiryRejection`
reproduces this with the actual Capacitor `PluginCall`, not a substitute parser.

## Changes

- Strict integer expiry decoding accepts JSON Number representations without
  accepting strings, fractional, negative, or non-finite values.
- One root auth listener handles restored, signed-in, refreshed, updated, and
  signed-out sessions. It is installed before startup reconciliation and is no
  longer recreated on every route change.
- A coordinator exposes restoring/authenticated/unauthenticated/temporary-error.
  Only an acknowledged native vault write produces authenticated readiness.
  Failed synchronization retries at bounded intervals and on later app focus.
- Cookie-authenticated exchange remains same-origin, no-store, and verifies the
  Supabase user before returning that user's session. No server route or secrets
  were added or changed.
- Web logout clears old native credentials; an old native record cannot resurrect
  a logged-out browser. A newer background rotation can update the same signed-in
  browser user. Account switches discard obsolete handoffs.
- Ordered JS mutations and native handoff tickets prevent delayed writes after
  logout/account switching. Auth-state metadata is encrypted with the existing
  Keystore vault. Receiver jobs retain their known owner during restoration.
- Missing vault/restoring/temporary failure means bounded worker retry, not
  confirmed logout. Jobs without a known owner are never silently reassigned to
  a subsequently signed-in account; they require an explicit retry/share.
- Native refresh retains the existing HTTPS endpoint and atomic whole-session
  rotation. 5xx/timeouts preserve credentials. Definitive rejection clears them,
  while an active same-user browser repair can still finish its handoff.
- The debug-only Settings section displays presence, user-match, expiry state,
  and readiness. The plugin suppresses it in release APKs regardless of the
  hosted Next.js production build mode. No credentials are displayed/logged.

## Deployment and physical retest

This APK loads `https://reibry.vercel.app`. Both the updated hosted web bundle
and rebuilt APK are needed. No commit, push, or deployment was performed as part
of this change. Installing the APK alone against the old hosted helper is not
a complete test of the new handoff protocol.

1. Deploy the reviewed web changes through the normal workflow, then install
   `android/app/build/outputs/apk/debug/app-debug.apk` as an update.
2. Open REIBRY with the existing signed-in account. No logout/login should be
   necessary. In Settings → Native session (debug), verify Signed in, Ready,
   User match Yes, Refresh available Yes, and Access expired No. If temporarily
   unavailable, use Retry session sync and inspect credential-free ReibryAuth
   logcat entries.
3. Close and reopen the APK without signing in again. Recheck Ready, minimize,
   then share a fresh TikTok item to REIBRY.
4. Confirm Remembering → Remembered, with no normal Capture screen; tap the
   completed notification and confirm the exact Memory opens.
5. Repeat with YouTube, lock/unlock, offline/network recovery, and after token
   expiry. JVM tests force expiry/refresh without modifying real credentials.
6. Sign out, then sign in as a different test account. Confirm user match and
   that the previous user's queued work cannot submit for the new user.

No Android device was connected to ADB during this implementation. Physical
heads-up/background completion and OEM process-lifecycle checks remain pending.
The existing HIGH `reibry_memory_capture_v2` channel, sound, vibration, notification
appearance, PWA behavior, Capture/provider logic, and database schema are unchanged.
