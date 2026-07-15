-- Marketplace safety: user blocking and abuse reports.
-- Blocking is enforced at the database layer (messaging RPC + policies), not
-- just in the app, so a blocked user cannot contact someone through any path.

-- ── Blocks ──────────────────────────────────────────────────────────────────

create table if not exists public.blocks (
  id         uuid default gen_random_uuid() primary key,
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "blocks_select_own"
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy "blocks_insert_own"
  on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "blocks_delete_own"
  on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

create index if not exists blocks_blocked_idx on public.blocks(blocked_id, blocker_id);

-- True when either party has blocked the other.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ── Reports ─────────────────────────────────────────────────────────────────

create table if not exists public.reports (
  id                  uuid default gen_random_uuid() primary key,
  reporter_id         uuid references public.profiles(id) on delete cascade not null,
  reported_profile_id uuid references public.profiles(id) on delete cascade,
  reported_job_id     uuid references public.jobs(id) on delete set null,
  reason              text not null check (reason in
                        ('spam', 'harassment', 'impersonation', 'inappropriate_content', 'scam', 'other')),
  details             text check (char_length(details) <= 2000),
  status              text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at          timestamptz default now() not null,
  check (reported_profile_id is not null or reported_job_id is not null)
);

alter table public.reports enable row level security;

-- Reporters can file and see their own reports; resolution is service-role only.
create policy "reports_insert_own"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "reports_select_own"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create index if not exists reports_status_idx on public.reports(status, created_at);

-- ── Block enforcement in messaging ──────────────────────────────────────────

-- New conversations between blocked parties are refused.
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

  if public.is_blocked_between(caller_id, other_profile_id) then
    raise exception 'Conversation unavailable' using errcode = '42501';
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

-- Existing threads go quiet when either side blocks: no new messages.
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_thread_participant(thread_id)
    and not exists (
      select 1
      from public.thread_participants other
      where other.thread_id = messages.thread_id
        and other.profile_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), other.profile_id)
    )
  );

-- Outreach between blocked parties is refused at the database layer too.
drop policy if exists "outreach_insert_hirer" on public.outreach;
create policy "outreach_insert_hirer"
  on public.outreach for insert
  with check (
    auth.uid() = hirer_id
    and not public.is_blocked_between(hirer_id, talent_id)
  );
