begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
set local search_path = public, extensions;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  summary text,
  source_url text,
  source_platform text,
  source_type text not null check (source_type in ('link','social_post','video','article','screenshot','document','text')),
  raw_text text,
  category text,
  tags text[] not null default '{}',
  entities jsonb not null default '[]' check (jsonb_typeof(entities) = 'array'),
  possible_intents text[] not null default '{}',
  possible_actions jsonb not null default '[]' check (jsonb_typeof(possible_actions) = 'array'),
  confidence double precision check (confidence between 0 and 1),
  analysis_status text not null default 'processing' check (analysis_status in ('complete','partial','failed','processing')),
  evidence_sources jsonb not null default '[]' check (jsonb_typeof(evidence_sources) = 'array'),
  analysis_metadata jsonb check (jsonb_typeof(analysis_metadata) = 'object'),
  embedding vector(2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.life_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('event','goal','deadline','trip','task','project','interest','reminder')),
  title text not null check (length(trim(title)) > 0),
  description text,
  start_date timestamptz,
  end_date timestamptz,
  status text not null default 'active' check (status in ('active','completed','cancelled','archived')),
  confidence double precision check (confidence between 0 and 1),
  embedding vector(2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  unique (id, user_id)
);

create table public.memory_context_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null,
  life_context_id uuid not null,
  similarity double precision not null check (similarity between -1 and 1),
  confidence double precision check (confidence between 0 and 1),
  reason text not null,
  suggested_action jsonb check (jsonb_typeof(suggested_action) = 'object'),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, memory_id, life_context_id),
  foreign key (memory_id, user_id) references public.memories(id, user_id) on delete cascade,
  foreign key (life_context_id, user_id) references public.life_contexts(id, user_id) on delete cascade
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid,
  life_context_id uuid,
  match_id uuid,
  type text not null check (type in ('shopping_list','revision_plan','itinerary','checklist','reminder')),
  title text not null check (length(trim(title)) > 0),
  description text,
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  status text not null default 'suggested' check (status in ('suggested','accepted','completed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (num_nonnulls(memory_id, life_context_id, match_id) >= 1),
  foreign key (memory_id, user_id) references public.memories(id, user_id) on delete cascade,
  foreign key (life_context_id, user_id) references public.life_contexts(id, user_id) on delete cascade,
  foreign key (match_id, user_id) references public.memory_context_matches(id, user_id) on delete cascade
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid,
  match_id uuid,
  action_id uuid,
  type text not null check (type in ('useful','not_useful','dismissed','incorrect_match')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(memory_id, match_id, action_id) = 1),
  check (type <> 'incorrect_match' or match_id is not null),
  foreign key (memory_id, user_id) references public.memories(id, user_id) on delete cascade,
  foreign key (match_id, user_id) references public.memory_context_matches(id, user_id) on delete cascade,
  foreign key (action_id, user_id) references public.actions(id, user_id) on delete cascade
);

create index memories_user_created_idx on public.memories(user_id, created_at desc);
create index life_contexts_user_status_idx on public.life_contexts(user_id, status);
create index matches_user_life_idx on public.memory_context_matches(user_id, life_context_id);
create index actions_user_created_idx on public.actions(user_id, created_at desc);
create index feedback_user_created_idx on public.feedback(user_id, created_at desc);
-- vector(2048) exceeds pgvector's vector ANN index dimension limit (2000).
-- Keep full precision storage; Person 2 will choose exact search or a tested halfvec expression index.

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','memories','life_contexts','memory_context_matches','actions','feedback'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

commit;
