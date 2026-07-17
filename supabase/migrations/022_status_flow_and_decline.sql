-- ============================================================
-- Atlas - Close the cross-role status loops.
-- 1. Applications gain a terminal 'declined' status so hirers
--    can give passed-over talent closure.
-- 2. New system-card kinds: application_declined, review_published,
--    job_closed.
-- 3. mark_application_replied(): lets the talent's reply advance
--    their application to 'responded' (applications are otherwise
--    hirer-update-only by RLS).
-- 4. is_caller_suspended(): suspension gate readable by the caller
--    without granting select on profiles.suspended_at (which would
--    leak everyone's suspension status).
-- ============================================================

-- 1. Applications: allow 'declined'.
alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('sent', 'viewed', 'responded', 'shortlisted', 'hired', 'declined'));

-- 2. Message kinds for the new cross-role events.
alter table public.messages
  drop constraint messages_kind_check;

alter table public.messages
  add constraint messages_kind_check
  check (kind in (
    'text',
    'application_received',
    'outreach_sent',
    'application_shortlisted',
    'application_hired',
    'application_declined',
    'review_published',
    'job_closed'
  ));

-- 3. Talent-side application transition. Applications are
-- hirer-update-only (applications_update_hirer), but "the talent
-- replied" is a talent-initiated fact. This narrow security-definer
-- function advances only the caller's own application on the given
-- job, and only from the pre-reply states - it can never regress a
-- shortlisted/hired/declined decision.
create or replace function public.mark_application_replied(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.applications
     set status = 'responded'
   where job_id = p_job_id
     and talent_id = caller_id
     and status in ('sent', 'viewed');
end;
$$;

revoke all on function public.mark_application_replied(uuid) from public;
revoke all on function public.mark_application_replied(uuid) from anon;
grant execute on function public.mark_application_replied(uuid) to authenticated;

-- 4. Suspension check for the caller only. profiles.suspended_at is
-- deliberately not column-granted to authenticated (005 revoked table
-- select; 013 added the column without a grant), so app code cannot
-- read it with a user session - this function is the supported path.
create or replace function public.is_caller_suspended()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.suspended_at is not null
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_caller_suspended() from public;
revoke all on function public.is_caller_suspended() from anon;
grant execute on function public.is_caller_suspended() to authenticated;
