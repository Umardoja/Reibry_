begin;
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','admin'));
revoke update(role) on public.profiles from authenticated;
grant update(display_name, onboarding_completed_at, updated_at) on public.profiles to authenticated;
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (length(event_name) between 1 and 80),
  source text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_user_id_idx on public.analytics_events (user_id, created_at desc);
alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon, authenticated;
grant insert on table public.analytics_events to authenticated;
create policy analytics_owner_insert on public.analytics_events for insert to authenticated with check ((select auth.uid()) = user_id and event_name = 'pwa_installed' and metadata = '{}'::jsonb);
commit;

-- One-time promotion, run manually with the intended authenticated user's UUID:
-- update public.profiles set role = 'admin' where user_id = '<AUTH_USER_UUID>';
