begin;
alter table public.profiles add column onboarding_completed_at timestamptz null;
-- Include old accounts whose profile was never created by the previous app.
insert into public.profiles (user_id) select id from auth.users on conflict (user_id) do nothing;
update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null;
-- No default: future users start with NULL. Owner RLS remains unchanged.
create function public.create_account_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_account_profile() from public;
create trigger create_reibry_profile after insert on auth.users
for each row execute function public.create_account_profile();
commit;
