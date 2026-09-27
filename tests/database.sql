-- Run only against a disposable migrated Supabase database as its postgres role.
-- All fixtures and mutations roll back. Fixed UUIDs are test fixtures, not credentials.
begin;
insert into auth.users(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.memories(id,user_id,title,source_type) values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A','text'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B','text');
insert into public.life_contexts(id,user_id,type,title) values
  ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','goal','A goal'),
  ('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','goal','B goal');

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);

do $$
declare affected integer;
begin
  if (select count(*) from public.memories) <> 1 then raise exception 'Memory SELECT isolation failed'; end if;
  if (select count(*) from public.life_contexts) <> 1 then raise exception 'Life SELECT isolation failed'; end if;
  update public.memories set title = 'forbidden' where id = '22222222-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'UPDATE isolation failed'; end if;
  delete from public.memories where id = '22222222-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'DELETE isolation failed'; end if;
  begin
    insert into public.memories(user_id,title,source_type) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','forbidden','text');
    raise exception 'INSERT isolation failed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.memories set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'Ownership change allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.memory_context_matches(user_id,memory_id,life_context_id,similarity,reason)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',0.5,'forbidden');
    raise exception 'Cross-owner match allowed';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.actions(user_id,memory_id,type,title)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','checklist','forbidden');
    raise exception 'Cross-owner action allowed';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.feedback(user_id,memory_id,type)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','useful');
    raise exception 'Cross-owner feedback allowed';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.memories set confidence = 1.1 where id = '11111111-1111-4111-8111-111111111111';
    raise exception 'Invalid confidence allowed';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.profiles(user_id,display_name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A');
insert into public.memory_context_matches(id,user_id,memory_id,life_context_id,similarity,reason)
values ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',0.5,'Owned');
insert into public.actions(id,user_id,match_id,type,title)
values ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','checklist','Owned action');
insert into public.feedback(user_id,action_id,type)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','useful');

-- A second session identity cannot see the first user's dependent records.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',true);
do $$
begin
  if exists(select 1 from public.profiles) or exists(select 1 from public.memory_context_matches)
    or exists(select 1 from public.actions) or exists(select 1 from public.feedback)
    then raise exception 'Dependent table SELECT isolation failed'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
delete from public.memories where id = '11111111-1111-4111-8111-111111111111';
do $$
begin
  if exists(select 1 from public.memory_context_matches) or exists(select 1 from public.actions)
    or exists(select 1 from public.feedback) then raise exception 'Cascade failed'; end if;
end;
$$;
rollback;
