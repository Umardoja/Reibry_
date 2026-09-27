# Shared Capture reliability

Capture first persists a source-derived partial Memory, then attempts the selected
AI analyzer with the existing timeout policy. If analysis fails, Capture finalizes
the original as partial. This is source preservation, not mock analysis: metadata
records `provider: source-preservation` and `providerUsed: fallback`. The selected
Gemini model, provider factory, embeddings and `AI_ALLOW_MOCK_FALLBACK` are unchanged.
Other provider operations and strict provider verification are unchanged.

Source-only output uses a whitespace-normalized title of at most 120 characters,
a source summary of at most 4,000 characters, category Other, an available platform
tag, and empty entities/intents/actions. Full original text/evidence stays stored.
An explicit recapture of a historical failed Memory recovers that same row as
partial; normal duplicate captures still skip AI work. No rows are deleted.

The existing `/api/memory/analyze` service is currently a stub. Partial Memories
retain their raw text, URLs and evidence for future reanalysis, but this pass does
not claim that the endpoint already performs reanalysis.

Only a valid pending share automatically submits, after RequireAuth permits the
Capture content to mount. A synchronous sessionStorage claim and an in-flight
promise shared across remounts prevent duplicate automatic requests. Completion
consumes the pending payload. Reloading an interrupted attempt requires explicit
Retry; a database dedupe key remains the final concurrency safeguard. Manual and
query-prefilled Capture remain explicit.

Shared completion stays on a compact receiver with an optional View memory link.
Notifications are sent only if permission is already granted. Processing,
completion (including partial) and failure use the same pending-share tag. The
worker validates same-origin destinations and exact Memory IDs; failure taps
return to the retained pending share for explicit retry.

## Local QA, 22 September 2026

- Real vt.tiktok.com share: one POST, HTTP 200, historical failed record recovered
  as partial; no automatic Detail navigation.
- Fresh text share: Gemini returned 503 UNAVAILABLE with mock fallback disabled;
  Capture returned 200 and retained the original text as partial.
- Signed-out TikTok share: Auth preserved next, then one automatic POST; real
  caption displayed on completion. Refresh did not resubmit a consumed share.
- Notification lifecycle and safe exact-Memory clicks are regression tested.
  Physical Android notification replacement/tap behavior remains to verify.
- Real long TikTok title checked at 390px and 430px; four-line clamp, expansion
  and collapse work. No horizontal overflow detected.

## Files in this pass

Created:
- `src/lib/capture/source-preservation.ts`
- `src/lib/share/capture.ts`
- `src/components/design/memory-title.tsx`
- `tests/share-capture-reliability.test.ts`
- `docs/SHARE_CAPTURE_RELIABILITY.md`

Modified:
- `src/lib/integration/orchestrator.ts`
- `src/app/capture/page.tsx`
- `src/lib/pwa/notifications.ts`
- `public/sw.js`
- `src/app/memories/[id]/page.tsx`
- `src/app/globals.css`
- `package.json` (adds the new test file without removing existing files)

## PWA limits

Web Share Target launches the installed PWA. REIBRY cannot guarantee TikTok stays
foregrounded, switch Android tasks, close itself reliably, or guarantee execution
after Android suspends/kills the PWA. Notifications do not grant background runtime.
Returning to the source app before the request completes may interrupt completion
UI/notifications. An acknowledged source insert remains partial in the database;
Retry uses deduplication. No native receiver or permission prompt was added.

Phone verification: share a fresh TikTok link while signed in and signed out;
verify one save, Remembering → Remembered under the same notification, tap to the
exact Memory, and test returning to TikTok during processing. Repeat with denied
notification permission and an interrupted network request.
