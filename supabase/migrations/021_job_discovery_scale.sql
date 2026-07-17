-- ============================================================
-- Atlas — Job discovery at scale
-- The talent discover feed previously loaded every open job in
-- the talent's category and filtered/sorted client-side, which
-- stops working past a few hundred jobs. This migration adds the
-- schema the server-side feed needs:
--   1. Structured budget bounds (budget_min/budget_max) so rate
--      filters and rate sorting run in SQL instead of regexing
--      the free-text budget in the browser. Parsed at write time
--      by the jobs API; backfilled here for existing rows.
--   2. job_passes so a talent's passes survive reload and are
--      excluded from the feed server-side.
--   3. Partial indexes matching the discover feed's hot queries.
--   4. open_job_locations() for the location filter dropdown
--      (Supabase JS has no `select distinct`).
-- ============================================================

alter table public.jobs
  add column if not exists budget_min integer,
  add column if not exists budget_max integer;

comment on column public.jobs.budget_min is
  'Lowest number found in the free-text budget, for filtering/sorting. Set by the API on insert.';
comment on column public.jobs.budget_max is
  'Highest number found in the free-text budget, for filtering/sorting. Set by the API on insert.';

-- Backfill bounds from the existing free-text budget ("£300 per day",
-- "£250 - £500"). Min/max over every number in the string; numbers
-- longer than 9 digits are ignored rather than overflowing integer.
update public.jobs j
set budget_min = b.min_val,
    budget_max = b.max_val
from (
  select j2.id,
         min(replace(m.groups[1], ',', '')::integer) as min_val,
         max(replace(m.groups[1], ',', '')::integer) as max_val
  from public.jobs j2,
       lateral regexp_matches(j2.budget, '\d[\d,]*', 'g') as m(groups)
  where j2.budget is not null
    and length(replace(m.groups[1], ',', '')) <= 9
  group by j2.id
) b
where j.id = b.id;

-- Passes persist per talent so the feed stays consistent across
-- sessions and devices. Rows are only ever visible to their owner.
create table public.job_passes (
  talent_id  uuid references public.profiles(id) on delete cascade not null,
  job_id     uuid references public.jobs(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (talent_id, job_id)
);

alter table public.job_passes enable row level security;

create policy "job_passes_select_own"
  on public.job_passes for select
  to authenticated
  using (talent_id = auth.uid());

create policy "job_passes_insert_own"
  on public.job_passes for insert
  to authenticated
  with check (talent_id = auth.uid());

create policy "job_passes_delete_own"
  on public.job_passes for delete
  to authenticated
  using (talent_id = auth.uid());

-- Discover feed hot paths: newest-first within a category, and
-- rate sorting, both only over open, non-removed jobs.
create index if not exists jobs_open_discover_idx
  on public.jobs (category, created_at desc, id desc)
  where status = 'open' and removed_at is null;

create index if not exists jobs_open_budget_max_idx
  on public.jobs (budget_max desc, id desc)
  where status = 'open' and removed_at is null;

-- Distinct locations across open jobs for the filter dropdown.
-- Runs with invoker rights; jobs are select-all under RLS.
create or replace function public.open_job_locations()
returns setof text
language sql
stable
set search_path = public
as $$
  select distinct location
  from public.jobs
  where status = 'open' and removed_at is null
  order by location
$$;
