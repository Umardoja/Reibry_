# Android Capture / Share Target / notification reliability

## Diagnosis (22 September 2026)

The public HTTPS production endpoint `https://reibry.vercel.app/manifest.webmanifest` returned HTTP 200 with **no `share_target` property**, no `id`, and only `/icons/icon.svg`. Production HTML correctly referenced `/manifest.webmanifest`. Thus the deployed manifest does not register an Android share destination. The installed phone package/cache could additionally be stale; it was not inspected remotely.

The current checkout likewise had no service worker, worker registration, share receiver, or `/api/share-target/pending` endpoint. Capture supported query prefilling, but the authenticated guard discarded the current Capture query when sending the visitor to Auth.

TikTok was recognized as a platform but used generic web enrichment, which intentionally declines redirects. There was no TikTok short-link resolver or public oEmbed path. The Capture composer recognized a URL only when its first line was entirely a URL, so captions with embedded URLs could become text captures.

The reported repeated Android-button glitch was **not reproduced as duplicate POSTs** in the local baseline. A baseline double-click encountered a safe provider failure. Updated local double-click checks recorded one `[capture] submitting` and one server `POST /api/capture` per action. Fresh text and TikTok analysis reached Gemini but timed out at its unchanged 20-second limit. That remains a separate provider availability problem, not proof of duplicate submission.

## Implemented behavior

### Share registration and pending data

The local generated manifest now contains:

```json
{
  "id": "/today",
  "name": "REIBRY",
  "short_name": "REIBRY",
  "start_url": "/today",
  "scope": "/",
  "display": "standalone",
  "share_target": {
    "action": "/share-target",
    "method": "GET",
    "enctype": "application/x-www-form-urlencoded",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

The ID matches the previous implicit start-URL identity. PNG icons at 192 and 512 pixels and a separate 512px maskable icon are generated from the existing REIBRY SVG. The notification badge is monochrome.

`/share-target` centrally normalizes title/text/url, including embedded URLs, then creates a unique pending ID in **sessionStorage** and replaces the receiver with `/capture?share=<id>`. No new server pending API or database storage is necessary for this explicit same-tab save flow. Pending data survives the same-tab auth redirect and refresh, expires after 24 hours when read, and is cleared only after a successful Capture response. Capture reload never submits automatically. Restricted storage falls back to explicit query prefill. These contents are not stored in localStorage.

The auth guard now preserves the current safe product destination. Existing Auth `safeNext` validation remains intact. Shared Capture replaces its history entry with the resulting Memory, avoiding back-navigation into an already acknowledged share. Auto-save was deliberately not enabled.

### TikTok

Supported HTTPS hosts: `tiktok.com`, `www.tiktok.com`, `m.tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`. Supported canonical path: `/@creator/video/<numeric-id>`; short forms include `/t/...` and vm/vt links.

The TikTok-only resolver uses a manual redirect request boundary, maximum three redirect hops, and a 2.5-second total resolution budget. The Node HTTPS transport never follows redirects automatically. Every requested hop is allowlisted, rejects credentials/nonstandard ports/non-HTTPS destinations, checks all DNS answers against private/reserved address rules, and pins the connection to a checked address while retaining TLS hostname verification. Redirect response bodies are not downloaded. oEmbed has a separate 2.5-second budget and a 128KB streaming body limit; only JSON is consumed. External redirect destinations are rejected. Generic URL redirect behavior is unchanged.

Public metadata is fetched through TikTok's [documented oEmbed endpoint](https://developers.tiktok.com/docs/en/embed-videos). Only title, author, author URL, thumbnail, and source identity are used; embed HTML/scripts/video are never executed/downloaded. Original shared URL remains in `evidenceSources[].mediaUrl`; resolved identity is stored in `sourceUrl` and optional `canonicalUrl`. Captions remain available to the existing analyzer. Optional `canonicalUrl`/`authorUrl` were added to the shared SourceEvidence type and strict decoder, not to SQL columns.

An exact owned dedupe lookup runs first. A resolved canonical key gets a second owned lookup before oEmbed/AI. Canonical tracking/fragment variants share the same key; the existing database uniqueness protection is retained. Repeated resolved short links can require redirect resolution again, but skip metadata/AI when their canonical Memory already exists. Historical rows stored under unresolved short-link keys are not automatically merged/deleted. If resolution is unavailable, canonical equivalence cannot always be established.

Metadata failure preserves URL/platform/caption. Successful analysis with URL-only evidence is finalized as partial; provider failure retains the existing failed lifecycle and safe error. No fallback was enabled and no provider/model/embedding configuration changed.

### Capture and notifications

A synchronous submission gate now owns `idle → submitting → complete/partial/duplicate/error`. It is acquired before React renders, admits one request, and permits one completion navigation. Error unlocks deliberate retry; input remains visible. Prefill is guarded against repeated effects. Safe local diagnostics contain only submission state, HTTP status, and duplicate boolean.

Worker registration happens without asking permission. The optional **Enable notifications** control in Capture requests permission only after a user gesture. Granted/denied/default/unsupported states are handled; denial is not repeatedly prompted.

Successful complete/partial saves, including existing complete/partial duplicate results, call `ServiceWorkerRegistration.showNotification()`. Title is `Remembered`, body is at most 100 characters of the real Memory title, tag is `reibry-memory-<id>`, and data contains the exact `/memories/<id>` destination and ID. Failed/processing records do not generate a completion notification. Notification errors never fail the save. There is no `new Notification()` implementation.

`notificationclick` closes the notification, validates same origin and the exact UUID Memory path, then navigates/focuses an existing client or opens a new one. Auth preserves that destination if the user must sign in. The worker has **no fetch handler**, so it does not cache/intercept authentication, private pages, or Capture APIs. Its delivery uses no-store headers.

This is client-request completion notification delivery, **not Web Push or a guaranteed background job**. Returning to the source app may work while the PWA remains alive, but Android can suspend/kill the page before completion. Closing/killing the PWA, losing the tab/sessionStorage, or OS background restrictions can prevent delivery. Future server jobs/Web Push can reuse the notification data/deep-link contract.

## QA and validation

- Production manifest and HTML fetched directly: HTTP 200; deployed `share_target` absent. No deployment was performed.
- Local generated manifest: HTTP 200 with the new share target; `/sw.js`: HTTP 200 with no-store headers.
- Public TikTok documented sample: live oEmbed returned title and author through the restricted adapter.
- The old failed account short URL: live resolver successfully returned its canonical TikTok video URL.
- Browser submission of that old short URL: one HTTP 200 duplicate response opened the pre-existing failed Memory. Legacy records were not silently reanalyzed or replaced.
- Browser embedded-URL share: receiver preserved title/caption/URL and opened Capture with a pending ID.
- Browser canonical TikTok Capture: metadata reached Memory evidence; Gemini timed out; safe HTTP 503; failed record displayed original evidence rather than permanent processing.
- Browser retry of that duplicate: HTTP 200, same existing Memory, one navigation. This is duplicate handling, not a successful new Gemini analysis.
- Reopening the consumed pending ID: empty composer, disabled Remember button, no automatic Capture POST.
- Fresh text Capture: one POST, safe Gemini timeout/error, input retained and Retry available.
- Existing YouTube Capture: HTTP 200 duplicate, original complete Memory opened.
- Auth-return verification: signed-out receiver reached `/auth?next=<encoded Capture pending ID>`; pending content preserved through sign-in.
- OS notification display/click, Android share-sheet registration and background delivery still require physical-device QA. Notification payload/click paths are covered with mocked browser/worker boundaries, not claimed as phone-tested.

Validation: lint PASS (zero errors/warnings), typecheck PASS, **108 tests PASS / 0 failed / 0 skipped** (all 83 existing plus 25 focused regressions), full production build PASS including `/share-target`, `git diff --check` PASS. The first restricted lint process stalled; the successful final lint ran with process permissions. No tests were removed or weakened.

## Android rollout checklist (after reviewed deployment)

1. Deploy the reviewed branch changes to the **same production HTTPS origin**, then fetch `https://reibry.vercel.app/manifest.webmanifest` and confirm `share_target.action` is `/share-target` and all PNG icons return 200. Current production still lacks these changes.
2. Uninstall the existing REIBRY PWA. Remove a duplicate/old installed REIBRY entry if Android still lists it. If necessary clear that site's old installation/site data, understanding that this signs you out and discards pending local shares; it does not delete server Memories.
3. Open `https://reibry.vercel.app/` in Android Chrome and install REIBRY again. Confirm name/icon; close and reopen.
4. Share a webpage, then a YouTube link. Find REIBRY in the normal app target list (including More if needed). Confirm prefill, sign-in return if required, and explicit Remember.
5. Share a TikTok short URL with a caption. Confirm TikTok source and real metadata when available. Share its canonical/tracking variant again and confirm the existing Memory opens.
6. Tap **Enable notifications** inside REIBRY and grant the Android/browser permission. Save a fresh Memory while the provider is healthy. Return to the source app without force-killing REIBRY, wait, then tap the notification and verify the exact Memory Detail.
7. Repeat with permission denied: Capture must still work and no repeated prompt should appear. Test notification click while signed out: sign-in must return to that Memory.
8. Double-tap Remember, refresh Capture, and revisit a consumed share: one POST per deliberate action and no automatic resubmission. Confirm no duplicated Memory row.
9. Repeated use may affect Android's target ordering, but **Android controls Sharesheet ranking**. REIBRY does not force itself to the first position.

## File inventory

Modified: `next.config.ts`, `package.json`, `src/app/capture/page.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/memories/page.tsx` (client-safe taxonomy import only), `src/components/auth/require-auth.tsx`, `src/components/design/memory.tsx` (TikTok label), `src/components/layout/app-shell.tsx` (public receiver shell), `src/lib/integration/dedupe.ts`, `src/lib/integration/orchestrator.ts`, `src/lib/integration/schemas.ts`, `src/lib/sources/adapters.ts`, `src/lib/sources/enrichment.ts`, `src/types/reibry.ts`.

Added: `public/sw.js`, four PNG icons in `public/icons`, `scripts/generate-pwa-icons.mjs`, `src/app/share-target/page.tsx`, `src/components/pwa/registration.tsx`, `src/components/pwa/notification-control.tsx`, `src/lib/capture/submission.ts`, `src/lib/pwa/notifications.ts`, `src/lib/share/payload.ts`, `src/lib/share/pending.ts`, `src/lib/sources/categories.ts` (existing taxonomy extracted unchanged), `src/lib/sources/prepare-capture.ts`, `src/lib/sources/tiktok-url.ts`, `src/lib/sources/tiktok.ts`, `tests/pwa-share-target.test.ts`, `tests/tiktok-source.test.ts`, and this report.

## Remaining blockers

- **HIGH:** reviewed changes are local only; production must be deployed before reinstalling can register the new share target.
- **HIGH:** real Gemini calls timed out during this session; new-save success and notification end-to-end require a healthy provider. No configuration change was made to hide this.
- **MEDIUM:** physical Android registration, permission, notification click, and background-lifetime tests remain pending.
- **MEDIUM:** previously failed/unresolved legacy short-link rows remain unchanged; their existing dedupe result can open a failed Memory. No destructive cleanup or speculative data migration was performed.

No Supabase migration, provider/model change, UI redesign, commit, or push was performed.
