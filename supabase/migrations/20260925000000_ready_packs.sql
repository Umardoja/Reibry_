create table if not exists public.ready_packs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  life_context_id uuid not null, title text not null check (char_length(title) between 1 and 300),
  pack_type text not null check (pack_type in ('travel','event','learning')), status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, user_id), foreign key (life_context_id, user_id) references public.life_contexts(id, user_id) on delete cascade
);
create table if not exists public.ready_pack_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  ready_pack_id uuid not null, memory_id uuid not null, section text not null, relevance_reason text not null,
  relevance_strength text not null check (relevance_strength in ('direct','strong','related')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (ready_pack_id, memory_id), foreign key (ready_pack_id, user_id) references public.ready_packs(id, user_id) on delete cascade,
  foreign key (memory_id, user_id) references public.memories(id, user_id) on delete cascade
);
create index if not exists ready_packs_user_status_idx on public.ready_packs(user_id, status, created_at desc);
create index if not exists ready_pack_items_pack_idx on public.ready_pack_items(user_id, ready_pack_id);
alter table public.ready_packs enable row level security;
alter table public.ready_pack_items enable row level security;
drop policy if exists ready_packs_owner on public.ready_packs;
create policy ready_packs_owner on public.ready_packs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists ready_pack_items_owner on public.ready_pack_items;
create policy ready_pack_items_owner on public.ready_pack_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
