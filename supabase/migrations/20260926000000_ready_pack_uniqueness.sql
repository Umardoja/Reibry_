-- Keep one active Ready Pack per intention. Preserve the oldest active Pack and merge its unique items.
do $$
declare
  duplicate_group record;
  keeper_id uuid;
  duplicate_id uuid;
begin
  for duplicate_group in
    select user_id, life_context_id, array_agg(id order by created_at, id) as pack_ids
    from public.ready_packs
    where status = 'active'
    group by user_id, life_context_id
    having count(*) > 1
  loop
    keeper_id := duplicate_group.pack_ids[1];
    foreach duplicate_id in array duplicate_group.pack_ids[2:array_length(duplicate_group.pack_ids, 1)] loop
      insert into public.ready_pack_items (user_id, ready_pack_id, memory_id, section, relevance_reason, relevance_strength, created_at, updated_at)
      select user_id, keeper_id, memory_id, section, relevance_reason, relevance_strength, created_at, now()
      from public.ready_pack_items
      where ready_pack_id = duplicate_id
      on conflict (ready_pack_id, memory_id) do nothing;
      delete from public.ready_packs where id = duplicate_id and user_id = duplicate_group.user_id;
    end loop;
  end loop;
end $$;

create unique index if not exists ready_packs_one_active_per_intention_idx
  on public.ready_packs (user_id, life_context_id)
  where status = 'active';
