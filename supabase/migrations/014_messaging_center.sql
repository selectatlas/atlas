-- Messaging center: thread origin context + per-participant archive state.

alter table public.message_threads
  add column origin_outreach_id uuid references public.outreach(id) on delete set null,
  add column origin_job_id uuid references public.jobs(id) on delete set null;

alter table public.thread_participants
  add column archived_at timestamptz;

-- Distinct name (not an overload of create_or_get_thread) so PostgREST RPC
-- resolution stays unambiguous and the existing 1-arg function keeps working.
create or replace function public.create_or_get_thread_with_origin(
  other_profile_id uuid,
  origin_outreach uuid default null,
  origin_job uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  found_thread_id uuid;
begin
  found_thread_id := public.create_or_get_thread(other_profile_id);

  -- Record origin only if not already set. Subselects validate ownership so a
  -- caller cannot attach an outreach or job that is not theirs.
  update public.message_threads t
     set origin_outreach_id = coalesce(t.origin_outreach_id,
           (select o.id
              from public.outreach o
             where o.id = origin_outreach
               and o.hirer_id = auth.uid()
               and o.talent_id = other_profile_id)),
         origin_job_id = coalesce(t.origin_job_id,
           (select j.id
              from public.jobs j
             where j.id = origin_job
               and j.hirer_id = auth.uid()))
   where t.id = found_thread_id;

  return found_thread_id;
end;
$$;

revoke all on function public.create_or_get_thread_with_origin(uuid, uuid, uuid) from public;
revoke all on function public.create_or_get_thread_with_origin(uuid, uuid, uuid) from anon;
grant execute on function public.create_or_get_thread_with_origin(uuid, uuid, uuid) to authenticated;

-- Best-effort backfill: link existing threads to the earliest outreach between
-- the same hirer/talent pair.
update public.message_threads t
   set origin_outreach_id = o.id
  from public.thread_participants hp
  join public.profiles h on h.id = hp.profile_id and h.account_type = 'hirer'
  join public.thread_participants tp
    on tp.thread_id = hp.thread_id and tp.profile_id <> hp.profile_id
  join lateral (
    select id
      from public.outreach
     where hirer_id = hp.profile_id
       and talent_id = tp.profile_id
     order by created_at asc
     limit 1
  ) o on true
 where t.id = hp.thread_id
   and t.origin_outreach_id is null;
