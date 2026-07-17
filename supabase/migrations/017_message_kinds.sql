-- ============================================================
-- Atlas - Structured system cards in message threads.
-- Messages gain a `kind` so thread events (application received,
-- outreach sent, shortlisted, hired) render as inline cards
-- instead of plain text bubbles.
-- ============================================================

alter table public.messages
  add column kind text not null default 'text';

alter table public.messages
  add constraint messages_kind_check
  check (kind in (
    'text',
    'application_received',
    'outreach_sent',
    'application_shortlisted',
    'application_hired'
  ));

-- Talent-initiated thread creation for the application system card.
-- create_or_get_thread only allows hirer -> talent, but the
-- "application received" card is emitted by the applicant, so this
-- function lets the applicant open (or reuse) the thread with the
-- job's hirer. Ownership is validated: only the application's talent
-- can call it, and the job origin is recorded if not already set.
create or replace function public.create_or_get_thread_for_application(target_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  app_talent_id uuid;
  app_job_id uuid;
  job_hirer_id uuid;
  found_thread_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select a.talent_id, a.job_id, j.hirer_id
    into app_talent_id, app_job_id, job_hirer_id
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where a.id = target_application_id;

  if app_talent_id is null then
    raise exception 'Application not found' using errcode = '22023';
  end if;

  if app_talent_id is distinct from caller_id then
    raise exception 'Only the applicant can open this conversation' using errcode = '42501';
  end if;

  if job_hirer_id is null or job_hirer_id = caller_id then
    raise exception 'A different participant is required' using errcode = '22023';
  end if;

  -- Same pairwise lock as create_or_get_thread so concurrent creation
  -- between the same two profiles never races into duplicate threads.
  perform pg_advisory_xact_lock(
    hashtextextended(least(caller_id::text, job_hirer_id::text) || ':' || greatest(caller_id::text, job_hirer_id::text), 0)
  );

  select mine.thread_id
    into found_thread_id
  from public.thread_participants mine
  join public.thread_participants theirs on theirs.thread_id = mine.thread_id
  where mine.profile_id = caller_id
    and theirs.profile_id = job_hirer_id
  limit 1;

  if found_thread_id is null then
    insert into public.message_threads default values
      returning id into found_thread_id;

    insert into public.thread_participants (thread_id, profile_id)
    values (found_thread_id, caller_id), (found_thread_id, job_hirer_id);
  end if;

  -- Record the job as origin context only if the thread has none yet.
  update public.message_threads t
     set origin_job_id = coalesce(t.origin_job_id, app_job_id)
   where t.id = found_thread_id;

  return found_thread_id;
end;
$$;

revoke all on function public.create_or_get_thread_for_application(uuid) from public;
revoke all on function public.create_or_get_thread_for_application(uuid) from anon;
grant execute on function public.create_or_get_thread_for_application(uuid) to authenticated;
