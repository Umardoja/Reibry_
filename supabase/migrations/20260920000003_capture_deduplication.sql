-- Capture deduplication is scoped to each authenticated user.
alter table public.memories
  add column if not exists dedupe_key text;

create unique index if not exists memories_user_dedupe_key_unique
  on public.memories (user_id, dedupe_key)
  where dedupe_key is not null;
