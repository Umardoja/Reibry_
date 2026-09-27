alter table public.memory_context_matches add column if not exists shown_at timestamptz;
create index if not exists matches_user_status_shown_idx on public.memory_context_matches(user_id,status,shown_at);
