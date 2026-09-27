-- REIBRY demo-data cleanup (REVIEW ONLY; DO NOT RUN AS-IS)
--
-- Replace the UUID below with a dedicated development/demo user id after
-- reviewing the preview counts. This script never touches auth.users or
-- profiles. It deletes only that user's dependent application data.
-- The final ROLLBACK is intentional: change it to COMMIT only after review.

begin;

create temporary table cleanup_targets (user_id uuid primary key) on commit drop;
insert into cleanup_targets (user_id)
values ('00000000-0000-0000-0000-000000000000'); -- REPLACE THIS UUID

-- Preview what would be removed.
select 'feedback' as table_name, count(*) as rows_to_delete from public.feedback f join cleanup_targets t on t.user_id = f.user_id
union all select 'actions', count(*) from public.actions a join cleanup_targets t on t.user_id = a.user_id
union all select 'memory_context_matches', count(*) from public.memory_context_matches m join cleanup_targets t on t.user_id = m.user_id
union all select 'life_contexts', count(*) from public.life_contexts l join cleanup_targets t on t.user_id = l.user_id
union all select 'memories', count(*) from public.memories m join cleanup_targets t on t.user_id = m.user_id;

-- Delete children before parents according to the migration foreign keys.
delete from public.feedback f using cleanup_targets t where f.user_id = t.user_id;
delete from public.actions a using cleanup_targets t where a.user_id = t.user_id;
delete from public.memory_context_matches m using cleanup_targets t where m.user_id = t.user_id;
delete from public.life_contexts l using cleanup_targets t where l.user_id = t.user_id;
delete from public.memories m using cleanup_targets t where m.user_id = t.user_id;

rollback;
