-- Additive compatibility migration for databases originally created from schema.sql.

create index if not exists thread_participants_profile_idx
  on public.thread_participants(profile_id, thread_id);
create index if not exists messages_thread_created_idx
  on public.messages(thread_id, created_at);

alter table public.messages
  add constraint messages_content_length_check
  check (char_length(content) between 1 and 5000) not valid;

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
    and (
      new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.account_type is distinct from old.account_type
    )
  then
    raise exception 'Profile identity fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity_before_update on public.profiles;
create trigger protect_profile_identity_before_update
  before update on public.profiles
  for each row execute procedure public.protect_profile_identity();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

create or replace function public.is_thread_participant(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.thread_participants participant
    where participant.thread_id = target_thread_id
      and participant.profile_id = auth.uid()
  );
$$;

create or replace function public.create_or_get_thread(other_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  caller_type text;
  other_type text;
  found_thread_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if other_profile_id is null or other_profile_id = caller_id then
    raise exception 'A different participant is required' using errcode = '22023';
  end if;

  select account_type into caller_type from public.profiles where id = caller_id;
  select account_type into other_type from public.profiles where id = other_profile_id;

  if caller_type is distinct from 'hirer' or other_type is distinct from 'talent' then
    raise exception 'Only hirers can start conversations with talent' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(caller_id::text, other_profile_id::text) || ':' || greatest(caller_id::text, other_profile_id::text), 0)
  );

  select mine.thread_id
    into found_thread_id
  from public.thread_participants mine
  join public.thread_participants theirs on theirs.thread_id = mine.thread_id
  where mine.profile_id = caller_id
    and theirs.profile_id = other_profile_id
  limit 1;

  if found_thread_id is not null then
    return found_thread_id;
  end if;

  insert into public.message_threads default values
    returning id into found_thread_id;

  insert into public.thread_participants (thread_id, profile_id)
  values (found_thread_id, caller_id), (found_thread_id, other_profile_id);

  return found_thread_id;
end;
$$;

revoke all on function public.is_thread_participant(uuid) from public;
revoke all on function public.create_or_get_thread(uuid) from public;
revoke all on function public.is_thread_participant(uuid) from anon;
revoke all on function public.create_or_get_thread(uuid) from anon;
grant execute on function public.is_thread_participant(uuid) to authenticated;
grant execute on function public.create_or_get_thread(uuid) to authenticated;

drop policy if exists "participants_select_own" on public.thread_participants;
drop policy if exists "participants_insert_own" on public.thread_participants;
drop policy if exists "participants_select_thread" on public.thread_participants;
drop policy if exists "participants_update_own" on public.thread_participants;
drop policy if exists "messages_select_participant" on public.messages;
drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_insert_participant" on public.messages;
drop policy if exists "threads_select_participant" on public.message_threads;

create policy "threads_select_participant"
  on public.message_threads for select
  using (public.is_thread_participant(id));

create policy "participants_select_thread"
  on public.thread_participants for select
  using (public.is_thread_participant(thread_id));
create policy "participants_update_own"
  on public.thread_participants for update
  using (profile_id = auth.uid() and public.is_thread_participant(thread_id))
  with check (profile_id = auth.uid() and public.is_thread_participant(thread_id));

create policy "messages_select_participant"
  on public.messages for select
  using (public.is_thread_participant(thread_id));
create policy "messages_insert_participant"
  on public.messages for insert
  with check (sender_id = auth.uid() and public.is_thread_participant(thread_id));
