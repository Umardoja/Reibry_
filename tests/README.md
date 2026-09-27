# Foundation verification

`npm test` runs dependency-free Node tests for validation boundaries (ownership injection, URLs, IDs, limits, source requirements, timezones). `npm run lint`, `npm run typecheck`, and `npm run build` check the application and all route imports.

With a local server running without Supabase environment variables, `node tests/smoke.mjs` verifies all pages, manifest/icon, and API validation/configuration errors.

Apply the migration to a disposable Supabase project before production use. Run `tests/database.sql` as postgres using psql with `-v ON_ERROR_STOP=1`; fixtures roll back. Verify with two test Auth users:

1. Insert a memory and Life context for each user under their session.
2. Each can read/update/delete only their own records; inserts or ownership updates with the other user ID must fail.
3. Matches, actions, and feedback referencing another user's records must fail, even if the new row has the current user's ID.
4. Invalid statuses, confidence outside 0–1, reversed dates, and invalid feedback targets must fail.
5. Deleting a parent removes dependent records, and updates refresh `updated_at`.

Use actual user sessions or `SET LOCAL ROLE authenticated` with test JWT claims. Testing solely with SQL editor/service-role access bypasses RLS and does not prove user isolation. No production database is modified by local application checks.

Initial local verification used disposable PostgreSQL 18 with a minimal `auth.users`/`auth.uid()` test shim and `real[]` in place of `vector(2048)`, because pgvector was unavailable locally. The relational migration, ownership policies, cross-owner foreign keys, confidence constraint, and cascading deletes passed. The temporary database and test roles were removed. This does not verify pgvector extension installation, vector dimensions, or hosted Supabase behavior; run the unmodified migration and this SQL test in a disposable Supabase project to verify those integration assumptions.
