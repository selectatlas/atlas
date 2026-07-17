-- Public job browsing: anonymous visitors can read the open-jobs marketplace
-- (list + detail) without a session. Actions (apply, save, alerts) stay
-- authenticated; profiles stay closed to anon (005) except for the narrow
-- hirer display fields exposed through the view below.

-- 1) Tighten jobs SELECT. The original jobs_select_all (000) applied to every
-- role, so anon could read closed and moderation-removed jobs. Authenticated
-- users keep the full read (hirer dashboards, admin); anon only sees the
-- open marketplace. jobs_manage_own is untouched.
drop policy if exists "jobs_select_all" on public.jobs;

create policy "jobs_select_authenticated"
  on public.jobs for select to authenticated using (true);

create policy "jobs_select_anon_open"
  on public.jobs for select to anon
  using (status = 'open' and removed_at is null);

-- RLS is row-level only: without column grants, anon could still select
-- ops/moderation internals (embedding_status, embedding_error,
-- embedding_attempts, removal_reason) straight off the table with the public
-- anon key. Grant anon exactly the marketplace columns. removed_at stays
-- readable because the invoker-rights facet RPCs (021/023) filter on it -
-- it is always null on every row anon can see. New jobs columns are
-- anon-invisible until added here deliberately.
revoke select on table public.jobs from anon;
grant select (
  id, hirer_id, title, description, category, skills_required, location,
  budget, budget_min, budget_max, status, created_at, removed_at, work_type,
  start_date, end_date, application_deadline, duration, usage_rights,
  travel_required, cover_url, search_tsv
) on public.jobs to anon;

-- 2) Public marketplace view. Runs with owner rights (same trust model as
-- match_jobs_filtered in 025), so it can read profiles despite 005's anon
-- revoke. The WHERE clause and the explicit column list ARE the security
-- boundary: only open, non-removed jobs; only the hirer's display fields.
-- Never select j.* here - future job columns must be opted in deliberately.
create or replace view public.public_open_jobs as
  select
    j.id, j.hirer_id, j.title, j.description, j.category, j.skills_required,
    j.location, j.budget, j.budget_min, j.budget_max, j.status, j.created_at,
    j.work_type, j.start_date, j.end_date, j.application_deadline,
    j.duration, j.usage_rights, j.travel_required, j.cover_url, j.search_tsv,
    p.full_name  as hirer_name,
    p.avatar_url as hirer_avatar_url
  from public.jobs j
  join public.profiles p on p.id = j.hirer_id
  where j.status = 'open' and j.removed_at is null;

comment on view public.public_open_jobs is
  'Anon-facing marketplace projection. Owner-rights on purpose (bypasses RLS): the WHERE clause and column list are the security boundary.';

grant select on public.public_open_jobs to anon, authenticated;

-- 3) Facet helpers (021/023) are invoker-rights and already executable via
-- the default PUBLIC function ACL; the anon policy above is what makes their
-- results non-empty for anon. Grants made explicit and self-documenting.
grant execute on function public.open_job_locations() to anon;
grant execute on function public.open_job_category_counts() to anon;
