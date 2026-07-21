-- ============================================================
-- Atlas - Talent-side application status tracking.
-- Talent had no way to see status changes on their applications:
-- the dashboard capped at 5 rows and inbox notifications were
-- hirer-only. This migration adds the minimal state needed for a
-- talent applications page with unread status-change badges:
--   1. status_changed_at - stamped by trigger whenever a hirer
--      moves an application through the status flow.
--   2. talent_seen_status - the last status the talent has
--      acknowledged; a badge shows while it differs from status.
-- Applications stay hirer-update-only (applications_update_hirer);
-- acknowledgement goes through a narrow security-definer function,
-- following the mark_application_replied precedent in 022.
-- ============================================================

alter table public.applications
  add column if not exists status_changed_at timestamptz,
  add column if not exists talent_seen_status text;

comment on column public.applications.status_changed_at is
  'Set by trigger on every status transition; null for applications that have never left their initial status.';
comment on column public.applications.talent_seen_status is
  'Last status value the talent acknowledged via mark_application_statuses_seen(); a status-change badge shows while this differs from status.';

create or replace function public.stamp_application_status_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists applications_status_change_stamp on public.applications;
create trigger applications_status_change_stamp
  before update on public.applications
  for each row execute function public.stamp_application_status_change();

-- Talent acknowledges the current status of all their applications.
-- Security definer because applications are hirer-update-only under
-- RLS; the function scopes strictly to the caller's own rows and can
-- only copy status into talent_seen_status - never change status.
create or replace function public.mark_application_statuses_seen()
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
     set talent_seen_status = status
   where talent_id = caller_id
     and talent_seen_status is distinct from status;
end;
$$;

revoke all on function public.mark_application_statuses_seen() from public;
revoke all on function public.mark_application_statuses_seen() from anon;
grant execute on function public.mark_application_statuses_seen() to authenticated;
