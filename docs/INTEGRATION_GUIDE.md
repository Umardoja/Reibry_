# REIBRY integration handoff

REIBRY is app-first: the product is an installable mobile PWA. Person 1 owns Supabase, Auth, RLS, API orchestration, Context Engine, Action Engine, deployment, and merges. API identity comes from authenticated Supabase SSR cookies; clients never send `userId`.

## Frozen API contracts

All responses use `{data, error}`. `GET /api/today` returns `{upcomingLifeContexts,resurfacedMemories,reminders,suggestedActions}`. Each resurfaced item contains `{memory,lifeContext,reason,similarity,confidence,status,suggestedAction}`. Suggested actions expose `{type,title,payload,memoryId,lifeContextId,status}`. Dismissed matches and failed Memories are excluded.

`POST /api/memory/search` accepts `{query,limit?}` and returns `{results:[{memory,similarity,reason?}]}` scoped to the authenticated user. `POST /api/context/feedback` accepts `{matchId,feedback}` where feedback is `useful`, `not_useful`, or `dismissed`; dismissal suppresses the match. Capture accepts `{sourceType:"text",rawText:"..."}`. Life creation accepts `{text:"...",timezone:"Africa/Lagos"}`. Matching accepts `{lifeContextId,memoryIds?}`. Actions accept `{type:"checklist",memoryId,lifeContextId}` and return a persisted proposal with `{id,type,title,payload,memoryId,lifeContextId,status,createdAt}`.

## Person 2 — NVIDIA / AI

Replace provider implementations behind existing interfaces without rewriting API routes: `src/lib/ai/service.ts` (`AIService.analyze`, `embed`, `parseLife`), `src/lib/retrieval/service.ts` (`RetrievalService.searchMemories`), Context relevance in `src/lib/context/service.ts`, and `ActionService.generate` in `src/lib/actions/service.ts`. Mock implementations remain deterministic. Embeddings remain `vector(2048)`.

## Person 3 — Core UI

Consumes `GET /api/today`, `POST /api/memory/search`, and `POST /api/context/feedback`, plus memory detail APIs as available. Owns Today, Memories, Memory Detail, navigation, responsive mobile-first UI, and the design system. The UI renders backend reasons directly and does not reproduce Context Engine logic.

## Person 4 — Capture / Life / Ask / app experience

Consumes `POST /api/capture`, `/api/life/create`, `/api/memory/search`, `/api/context/match`, `/api/actions`, `/api/context/feedback`, and Auth/session routes. REIBRY is app-first: Android Share Sheet → installed REIBRY PWA → Web Share Target → shared TikTok, Instagram, YouTube, or web URL → Capture flow → `POST /api/capture`. The Share Target is not implemented on this branch.

## Development

Use `AI_PROVIDER=mock` with `npm run dev`. `npm run seed:demo` requires the explicit disposable authenticated account in `REIBRY_TEST_EMAIL_A`/`REIBRY_TEST_PASSWORD_A` and is disabled when `NODE_ENV=production`. Run `npm run verify:api` while the dev server is running. Never use a service-role key in these scripts.
