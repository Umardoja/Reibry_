# REIBRY architecture

Discover → Capture → Understand → Remember → Connect to Life → Resurface → Act.

REIBRY uses Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth, and PostgreSQL with pgvector. This foundation defines contracts and boundaries, not product features.

## Layers

- **Memory Brain:** `memories` stores saved content, source evidence, analysis state, confidence, intents, possible actions, and embeddings. It supports links, posts, videos, articles, screenshots, documents, and text. Recipes, tutorials, and ideas can be categories instead of separate tables.
- **Life Brain:** `life_contexts` stores events, goals, deadlines, trips, tasks, projects, interests, and reminders, with optional dates and embeddings.
- **Capture Engine:** `/api/capture` is the future persistence entry point. `lib/sources` is the source normalization boundary. File uploads, social URL extraction, and share handling are deliberately absent.
- **AI layer:** `lib/ai/service.ts` defines vendor-neutral analysis, embedding, and Life parsing contracts. Person 2 supplies NVIDIA adapters, evidence handling, partial results, and confidence logic. No SDK or vendor call exists yet.
- **Retrieval:** `lib/retrieval/service.ts` defines semantic search. Embeddings must be 2048 finite numbers. They remain out of client-facing domain objects.
- **Context Matcher:** `lib/context/service.ts` connects memories with Life contexts and returns reasons, confidence, and suggested actions. No matching algorithm exists yet.
- **Action Engine:** `lib/actions/service.ts` defines generated shopping lists, revision plans, itineraries, checklists, and reminders. It does not execute external actions.
- **UI:** shared shell plus Today, Memories, memory detail, Capture, Ask, and Life placeholders. The root redirects to Today. No onboarding, final designs, or demo data are included.

## Integration flow

Route → Zod schema → verified Supabase session → typed service → future persistence/AI adapter.

`src/lib/api/services.ts` is the orchestration boundary. It currently throws explicit not-implemented errors. Person 1 will load records under the user's session before calling AI. Never accept a user ID from a client body or pass unchecked record IDs into an elevated database client. The scaffold uses strict schemas so unexpected fields fail validation.

## Database and security

All six user-owned tables reference `auth.users`; RLS covers SELECT, INSERT, UPDATE, and DELETE. Composite foreign keys enforce the same owner for related records, including matches, actions, and feedback. Parent deletion cascades to dependent records; account deletion deletes all owned records. Feedback has exactly one target, and incorrect-match feedback must target a match. Actions require at least one source.

UUID IDs, UTC timestamps, JSONB evidence/entities/actions, and text-array tags/intents keep the schema compact. Update triggers maintain `updated_at`. Confidence is nullable (unknown) or 0–1; cosine similarity is -1–1. Domain objects use camelCase and database columns use snake_case; add explicit row mapping and generated database types during persistence integration, rather than casting rows into domain objects. JSONB shapes must be validated by future write services.

Both knowledge layers store `vector(2048)`. There is deliberately no ANN index: pgvector's `vector` index limit is 2000 dimensions. Person 2 should evaluate exact search or a `halfvec` expression index without changing full-precision storage. See [pgvector documentation](https://github.com/pgvector/pgvector#hnsw).

Browser and server clients use the public key and the user's cookies. Server-only imports guard server helpers and API orchestration. A Next.js proxy refreshes page sessions; API handlers manage their own cookies and verify claims. Auth responses are not cached. No admin client or service-role usage exists. Public placeholder pages are not an authenticated product surface yet.

See the official [Supabase SSR pattern](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [Next.js setup](https://nextjs.org/docs/app/getting-started/installation).

## Ownership

| Developer | Owns | Primary areas |
| --- | --- | --- |
| Person 1 | Architecture, Supabase, auth, database, API structure, context/action engines, deployment, integration, merges | `supabase`, `lib/supabase`, `lib/api`, `lib/context`, `lib/actions`, route handlers |
| Person 2 | NVIDIA, multimodal/social-video analysis, embeddings, semantic search, reasoning, Life parsing, confidence | `lib/ai`, `lib/retrieval`, analysis evidence contracts |
| Person 3 | Today, Memories, detail UI, navigation, visual system | corresponding pages, `components/ui`, `components/memory`, `components/layout` |
| Person 4 | Onboarding, Capture UX, Ask, Life UX, sharing, loading/errors, demo flow | corresponding pages, `components/life`, future capture/onboarding components |

Coordinate shared type/schema/API edits through Person 1. Person 2 supplies intelligence behind interfaces; Person 3 and Person 4 build their screens against documented contracts. PWA service workers, uploads, auth screens, CRUD flows, and AI are intentionally deferred.
