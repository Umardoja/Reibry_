# REIBRY native Android share receiver

This is a thin Capacitor 8 Android host for the existing HTTPS Next.js deployment,
not a second frontend or a static export. `capacitor.config.json` loads only
`https://reibry.vercel.app`. The API routes remain on Vercel. The local `native-web`
assets are offline/error pages only. Native navigation is restricted to that origin;
external source links open in the system browser. Bridge methods additionally check
the current WebView origin. Capacitor bridge logging is disabled.

## Authentication audit and adapter

Before this pass, Capture required Supabase SSR cookies in both its API handler
and orchestration, and did not authenticate Authorization bearer headers. Browser
sessions remain in those cookies; no browser localStorage token was introduced.

Only Capture now opts into the bearer adapter. `captureIdentity` verifies a bearer
access token using Supabase `auth.getUser(token)`, then uses an anon-key client with
that user's Authorization header for RLS and existing ownership checks. A malformed
or invalid bearer never falls back to a different browser cookie identity. Other
API authentication behavior is unchanged. Capture business logic is shared.

The native-only client bridge POSTs to `/api/auth/native-session` using the browser
cookies. The endpoint requires the same Origin plus a custom header, verifies the
user, returns the user access/refresh pair with userId/expiry, and disables caching. No service-role/provider credentials are returned. The custom header is not
an authentication credential; cookie verification and same-origin policy are.

Android stores the short-lived session and queued source payloads as AES-GCM files
under no-backup storage, with the key in Android Keystore. WorkManager stores only
an opaque job UUID. Queued items are bound to the user who shared them. Sign-out
clears native credentials and cancels queued work/notifications before web sign-out.
An already accepted server request cannot be revoked by cancellation. Account
switching cannot submit another account's queued source.

User refresh credentials are now stored only in the same Keystore-backed encrypted vault. NativeSession serializes refresh via the HTTPS native-refresh endpoint, checks user ownership, rotates both tokens, and preserves concurrent sign-out. Foreground session restoration synchronizes the rotated pair back to Supabase SSR cookies before the protected-page guard checks them. Network failures retain credentials; irrecoverable refresh failures request sign-in.

## Share lifecycle

`ShareReceiverActivity` accepts only SEND + text/plain, validates bounded text and
subject, encrypts the payload, shows Remembering, enqueues unique WorkManager work,
and finishes without starting MainActivity. No network call runs in the receiver.
Android may show a brief system transition; the app does not force task switching.

The worker requires connected networking, requests expedited execution on Android 12+ with normal
work as the quota fallback (ordinary work on older Android), and POSTs to the existing HTTPS `/api/capture`. Redirects
are disabled so Authorization cannot be forwarded to another origin. Connect/read
timeouts are bounded. Transient network/429/5xx failures get at most three attempts,
with exponential backoff beginning at 30 seconds. Complete, partial and duplicate
results are all Remembered. Source enrichment, AI, partial preservation and dedupe
remain server responsibilities.

The `reibry_memory_capture_v2` channel (Memory saves) uses HIGH importance, sound and vibration. A job
uses a processing ID for Remembering/Waiting. Completion removes that ID and posts a distinct per-job result ID, so it can alert again without leaving stacked notifications.
Captions are not used in processing notifications; result titles are bounded and
lock-screen visibility is private. UUID-only notification extras route to the exact
Memory using a reused MainActivity. Existing safe-next auth routing handles expiry.
Failure notifications preserve a job identifier, never the source text or token.

Android 13+ permission is requested only through the existing Enable notifications
button in a visible native screen. With permission denied, saves can still run but
Android will not display normal notifications. The receiver never requests it.

The APK has exactly one SEND intent filter. The web manifest/service worker remain
available for PWA installations; installing both the PWA and APK separately can
show two independently installed REIBRY targets in Android's sharesheet.

## Build

Requirements: Node 22+, Java 21, Android SDK 36, accepted SDK licenses.

```powershell
npm ci
npx cap sync android
# Set sdk.dir in untracked android/local.properties for this machine.
cd android
.\gradlew.bat testDebugUnitTest assembleDebug
.\gradlew.bat build
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
Unit test report: `android/app/build/reports/tests/testDebugUnitTest/index.html`.
No release-signing keys are configured or included. Never copy .env files into
native assets. Generated assets and APKs are ignored by Git.

## Deployment and physical QA gate

The hosted web/native-session and Capture bearer changes must be deployed to the
configured production origin before this APK can sync authentication. This pass
does not deploy, commit or push. No device was connected at initial adb discovery.

1. Deploy the reviewed web changes; install the debug APK on an Android test phone.
2. Open REIBRY, sign in, open Capture and tap Enable notifications. Grant permission.
3. From TikTok share a fresh link to the native REIBRY destination. Confirm the
   normal Capture UI does not appear and Remembering is visible.
4. Continue using TikTok, lock/unlock the phone, then verify Remembered replaces
   progress. Tap it and confirm the exact persisted Memory opens.
5. Repeat with YouTube and with the same source twice; confirm duplicate results.
6. Share offline, reconnect and verify the queued job runs. Test expired auth and
   notification denial; never bypass Android battery or permission protections.
7. Sign out and switch accounts; verify old queued content is not submitted under
   the new account. Test normal browser/PWA capture separately.

WorkManager survives ordinary process death/reboots, but Android force-stop,
revoked permissions, OEM battery restrictions, token expiry and expedited quotas
still apply. No app can guarantee notifications when the user has denied them.

## Verification in this workspace

Gradle build, assembleDebug and JVM unit tests passed: 21 tests (20 capture tests plus the existing template test). These include pure contract tests and source-policy checks, not Android instrumented/device tests.

Local HTTP verification with the configured test account passed: cookie sign-in 200; native-session exchange 200 without a refresh token; bearer-only Capture 200 with user-owned partial Memory; duplicate capture 200 with the same Memory ID. Missing/invalid bearer requests returned 401.

The added Capacitor development CLI dependency chain currently reports three moderate npm audit advisories (Capacitor CLI, xcode, uuid). These are build-tool dependencies, not credentials or provider code bundled into the APK. Review upstream fixes before release tooling is finalized.


See ACCOUNT-RELIABILITY.md for the current migration, signup reproduction and physical QA gates.
