-- ============================================================
-- Atlas — Job search + discovery facets
-- Phase 2 of the scalable discover feed:
--   1. Real full-text search over jobs. The feed previously
--      matched with ilike substrings, which falls apart once
--      titles/descriptions number in the thousands. A stored
--      generated tsvector + GIN index gives word-stemmed search
--      ("dancers" matches "dancer") with websearch-style input.
--   2. open_job_category_counts() so the category chips on the
--      discover page can show live per-category market size in
--      one round trip.
-- ============================================================

alter table public.jobs
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english', title || ' ' || description || ' ' || location)
  ) stored;

comment on column public.jobs.search_tsv is
  'Stored FTS document over title/description/location; queried by the discover feed via websearch_to_tsquery.';

-- The feed only ever searches open, non-removed jobs.
create index if not exists jobs_search_tsv_idx
  on public.jobs using gin (search_tsv)
  where status = 'open' and removed_at is null;

-- Per-category counts of open jobs for the discover page category chips.
-- Runs with invoker rights; jobs are select-all under RLS.
create or replace function public.open_job_category_counts()
returns table (category text, job_count bigint)
language sql
stable
set search_path = public
as $$
  select category, count(*)::bigint as job_count
  from public.jobs
  where status = 'open' and removed_at is null
  group by category
$$;
