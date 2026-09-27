# REIBRY

Shared foundation for a personal AI memory system. This is not the full application.

## Local setup

Use Node.js 22.18 or newer and npm.

```powershell
npm ci
Copy-Item .env.example .env.local
# Fill in your Supabase URL and public anon key, then:
npm run dev
```

Open http://localhost:3000. Placeholder pages and production builds work without credentials; Supabase clients fail clearly when configuration is missing.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Supabase setup

1. Create a Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from its Connect/API settings. Only the public anon key belongs in this public variable; never use the service-role key.
2. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` locally and your HTTPS origin in deployment. This variable is reserved for future auth callbacks and absolute links.
3. Run `supabase/migrations/20260919000000_initial_foundation.sql` once in the Supabase SQL editor, or apply it using your team's Supabase CLI migration workflow. The migration enables pgvector. Do not reapply an already applied migration.
4. Configure Auth Site URL and allowed redirect URLs for localhost and the deployed origin when authentication flows are connected. Provider selection, sign-in UI, and callback routes are not implemented yet.
5. `SUPABASE_SERVICE_ROLE_KEY` and `NVIDIA_API_KEY` are reserved server-only variables and are not used by the foundation. They may remain blank. Never prefix these with `NEXT_PUBLIC_`.
6. Profiles are not created automatically. Person 1 will add profile provisioning during auth integration.

No database connection or hosted project is required for lint/build. Database verification instructions live in `tests/README.md`.

## Boundaries

All six POST endpoints validate JSON and session identity, then return `501 NOT_IMPLEMENTED` for configured, authenticated requests. Nothing is saved and no AI calls are made. Missing Supabase configuration returns `503`; missing/invalid sessions return `401`. Validation errors can be returned before authentication.

- [Architecture and ownership](docs/ARCHITECTURE.md)
- [API contracts](docs/API_CONTRACTS.md)
- [Git workflow](docs/GIT_WORKFLOW.md)

The web manifest and placeholder SVG icon establish a PWA-ready structure. Offline caching, service worker, push, share targets, and production icon assets are future work. Do not cache authenticated data by default.
# Reibry_
