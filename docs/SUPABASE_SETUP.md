# Supabase setup

Apply migrations in order:

1. `supabase/migrations/20260919000000_initial_foundation.sql`
2. `supabase/migrations/20260919000001_integration_additions.sql`

Set these variables in an untracked `.env.local` file:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AI_PROVIDER=mock
```

Enable Supabase Auth email/password sign-in. Email confirmation can remain enabled, but sign-in tests then require confirmation of the disposable test account.

The first migration enables the `vector` extension in the `extensions` schema and creates `vector(2048)` columns on `memories` and `life_contexts`. The dimension is intentional. Standard pgvector ANN indexes have a 2,000-dimension limit, so this project currently uses exact search or awaits a deliberate `halfvec` expression-index design.

Run locally with `npm install` followed by `npm run dev`. Keep `AI_PROVIDER=mock` until the NVIDIA provider is integrated.

For authenticated verification, set these additional untracked variables to disposable accounts:

```text
REIBRY_TEST_EMAIL_A=
REIBRY_TEST_PASSWORD_A=
REIBRY_TEST_EMAIL_B=
REIBRY_TEST_PASSWORD_B=
```

Run `npm run verify:auth`. The script uses only the anon key, tests authenticated memory/life persistence and RLS isolation, attempts an ownership spoof, and removes the disposable rows. It never prints credentials or tokens. If email confirmation is enabled, confirm both accounts in Supabase Auth before running it. To exercise the HTTP routes, run `npm run dev` in another terminal and use the documented `/api/capture`, `/api/life/create`, `/api/today`, and `/api/auth/session` routes with an authenticated browser session.

For the API cookie-flow check, run `npm run dev` in one terminal, set the same disposable account variables, then run `npm run verify:api`. The development seed is `npm run seed:demo`; it requires the authenticated development account and is disabled when `NODE_ENV=production`.

Verification commands are `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check`. Real verification should use disposable accounts and clean up their records afterward. Never commit passwords, service-role keys, or session tokens.

Common errors include `CONFIGURATION_ERROR` for missing variables, `AUTH_REQUIRED` for missing sessions, missing-table errors when migrations were skipped, and dimension errors when attempting a standard ANN index on `vector(2048)`.
