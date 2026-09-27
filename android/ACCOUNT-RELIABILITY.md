# Account, notification and onboarding handoff

## Verified causes

- Original notifications used DEFAULT importance and only-alert-once. v2 uses
  HIGH importance, default notification sound and vibration; no alarm/full-screen
  intent. Processing is removed before a distinct per-job completion notification
  is posted. OS permission, channel preferences, DND and OEM settings still govern
  actual heads-up presentation.
- Native storage previously held only expiring access tokens. There was no auth
  state subscription, refresh path, or guard dependency on native restoration.
  NativeSession now serializes user refresh-token rotation, verifies ownership,
  encrypts replacements, and does not repopulate storage after concurrent sign-out.
  A temporary network/server failure preserves credentials and retries. A rejected
  session requests sign-in. Foreground restoration updates the WebView's Supabase
  session before the guard checks cookies.
- Production browser Sign Up showed a generic error. A public-client probe returned
  HTTP 429 / over_email_send_rate_limit. Public auth settings confirmed email
  confirmation is required, signup is enabled and the email provider is enabled.
  A later local browser signup displayed the successful Check your email state;
  confirmation itself was not completed. API errors now preserve safe distinctions.
- Onboarding previously always followed normal sign-in and used localStorage as
  the authority. No completion column/profile creation trigger existed in the
  migrations. The new account API uses owner-scoped profiles instead.

## Deployment order (not executed by this pass)

1. Review and apply `supabase/migrations/20260922000000_account_onboarding.sql` once
   using the project's normal migration process. It backfills all pre-existing
   accounts, including missing profiles, adds the nullable completion column with
   **no default**, and creates profiles for future users. No accounts or app data
   are deleted. Existing owner RLS remains unchanged.
2. Deploy the web changes to `https://reibry.vercel.app`, including account,
   native-session, native-refresh and auth/callback routes.
3. Install the rebuilt debug APK. Open/sign in once to synchronize a refresh token
   into the existing encrypted vault. Old access-token-only installations are
   upgraded by this normal foreground sync.

There is no local database connection or management token configured for applying
SQL here. The migration has **not** been applied. Until applied, account lookup
returns a safe unavailable state with retry and Continue to REIBRY; onboarding
completion cannot be persisted yet.

## Supabase email configuration

In Authentication → URL Configuration set Site URL to the production HTTPS origin.
Allow `https://reibry.vercel.app/auth/callback` and the callback with safe-next query
parameters (a narrowly scoped `https://reibry.vercel.app/auth/callback?next=**`
pattern). For development allow the corresponding localhost:3000 callback entries.
Check the confirmation email template honors RedirectTo/ConfirmationURL rather
than a hardcoded different deployment. Review SMTP delivery and project email
rate limits; code does not bypass verification or quotas.

The callback exchanges a PKCE code and preserves validated internal next paths.
If opened in a different browser without its verifier, the user can sign in after
confirming their email. Native verified HTTPS App Links are not configured: they
need the final signing-certificate fingerprint and hosted assetlinks.json. Do not
claim automatic return from the email app into this debug APK. Confirmation in a
browser followed by reopening REIBRY and signing in remains available.

## Settings and diagnostics

Account menu → Settings shows account email, sign-out and real notification state.
Native settings opens only this package's app/channel Android settings. Returning
from system settings refreshes permission status. First-time onboarding offers
Enable notifications and Not now; neither permission denial nor absence traps it.

Debug APK bridge `ReibryCapture.notificationDiagnostics()` reports permission,
enabled state, v2 channel existence/importance/sound/vibration only. It is rejected
in release builds. Native log tag ReibryAuth contains only presence/expiry/status
diagnostics, never credentials or source content.

## Checks and limits

Local HTTP: native refresh 200, returned access token verified as the same user;
invalid refresh 401. Browser: production signup failure reproduced, local password
mismatch prevented submission, local confirmation-required signup succeeded.
Direct auth.users/profile row existence remains unverified: an admin enumeration
probe was rejected by automatic approval review and was not retried indirectly.

Physical device/PWA-installed tests remain required; adb reported no connected
device. Test fresh and existing accounts after migration, onboarding Skip/Finish
and reinstall, email confirmation, native expired-token recovery, TikTok/YouTube
processing and completion heads-up banners, exact Memory taps, denied permission,
and off/on changes in Android settings. Only the final useful notification should
remain in the shade. Existing PWA routes/service worker/share contracts remain.

Final checks: web lint/typecheck/build pass; 143/143 web tests; 32/32 Android JVM tests; Android lint 0 errors / 26 warnings (same warning count as baseline); assembleDebug passes. Local browser Settings displayed the actual account email and notification state and remained authenticated after refresh. An owner-scoped profile probe found zero profiles for the configured test account and PostgreSQL code 42703 for the new column, confirming the migration deployment gate.


## Files in this pass

- android/ACCOUNT-RELIABILITY.md
- android/app/build.gradle
- android/app/src/main/AndroidManifest.xml
- android/app/src/main/java/com/reibry/app/CaptureNotifications.java
- android/app/src/main/java/com/reibry/app/NativeSession.java
- android/app/src/main/java/com/reibry/app/ReibryCapturePlugin.java
- android/app/src/main/java/com/reibry/app/ReibryCaptureWorker.java
- android/app/src/main/java/com/reibry/app/ShareReceiverActivity.java
- android/app/src/test/java/com/reibry/app/AccountReliabilityTest.java
- android/app/src/test/java/com/reibry/app/CaptureContractTest.java
- android/README.md
- package.json
- src/app/api/account/route.ts
- src/app/api/auth/native-refresh/route.ts
- src/app/api/auth/native-session/route.ts
- src/app/api/auth/sign-in/route.ts
- src/app/api/auth/sign-up/route.ts
- src/app/auth/callback/route.ts
- src/app/auth/page.tsx
- src/app/globals.css
- src/app/onboarding/page.tsx
- src/app/settings/page.tsx
- src/components/auth/require-auth.tsx
- src/components/auth/sign-out-button.tsx
- src/components/layout/app-shell.tsx
- src/components/native/android-session.tsx
- src/components/pwa/notification-control.tsx
- src/lib/auth/account-policy.ts
- src/lib/auth/password-handler.ts
- src/lib/auth/service.ts
- src/lib/native/android.ts
- supabase/migrations/20260922000000_account_onboarding.sql
- tests/account-reliability.test.ts
- tests/native-auth.test.ts

Local Settings Sign out was exercised successfully and returned to /auth.
