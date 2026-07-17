-- ============================================================
-- Atlas — Semantic job matching for talent
-- Phase 3 of the scalable discover feed. Jobs have been embedded
-- since 000 (job_embeddings, populated at posting time); this
-- migration puts those vectors to work on the talent side:
--   1. match_jobs_filtered: semantic job search — query embedding
--      vs job embeddings with the discover feed's structured
--      filters pushed into SQL before the vector LIMIT. Service
--      role only (called by the API after embedding the query).
--   2. match_jobs_for_talent: the ranked "For you" stack — the
--      caller's own profile embedding vs open jobs, minus jobs
--      they passed on or applied to. Ordering gets small
--      category/skill boosts; the returned similarity stays the
--      raw cosine score so displayed match scores remain real
--      (same philosophy as 024).
--   3. job_alerts: talent-side saved searches with read-time
--      new-match counts against last_viewed_at (the same no-cron
--      design as hirer saved_searches in 016).
-- ============================================================

create or replace function public.match_jobs_filtered(
  query_embedding extensions.vector(1536),
  filters jsonb default '{}',
  exclude_ids uuid[] default '{}',
  match_count integer default 50
)
returns table (job_id uuid, similarity float)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select je.job_id,
         1 - (je.embedding <=> query_embedding) as similarity
  from public.job_embeddings je
  join public.jobs j on j.id = je.job_id
  where j.status = 'open'
    and j.removed_at is null
    and (
      not (filters ? 'categories')
      or j.category in (select jsonb_array_elements_text(filters->'categories'))
    )
    and (filters->>'work_type' is null or j.work_type = filters->>'work_type')
    and (filters->>'location' is null or j.location = filters->>'location')
    and (
      coalesce(filters->>'rate', 'any') = 'any'
      or (filters->>'rate' = 'under250' and j.budget_min < 250)
      or (filters->>'rate' = '250to500' and j.budget_max >= 250 and j.budget_min <= 500)
      or (filters->>'rate' = 'over500' and j.budget_max > 500)
    )
    and not (j.id = any(exclude_ids))
  order by je.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;

revoke execute on function public.match_jobs_filtered(extensions.vector, jsonb, uuid[], integer) from public, anon, authenticated;
grant execute on function public.match_jobs_filtered(extensions.vector, jsonb, uuid[], integer) to service_role;

-- Ranked stack for the signed-in talent. Empty when the caller has no
-- profile embedding yet — the API falls back to the regular feed.
-- Ordering boosts: +0.05 for a category the talent works in, +0.02 per
-- overlapping skill (capped at 3). Boosts affect ranking only.
create or replace function public.match_jobs_for_talent(match_count integer default 20)
returns table (job_id uuid, similarity float, category_match boolean, skill_overlap integer)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with my_embedding as (
    select embedding from public.profile_embeddings where profile_id = auth.uid()
  ),
  my_categories as (
    select distinct category from public.talent_skills where profile_id = auth.uid()
  ),
  my_skills as (
    select distinct lower(skill) as skill from public.talent_skills where profile_id = auth.uid()
  )
  select scored.job_id, scored.similarity, scored.category_match, scored.skill_overlap
  from (
    select
      j.id as job_id,
      1 - (je.embedding <=> me.embedding) as similarity,
      (j.category in (select category from my_categories)) as category_match,
      (
        select count(*)::integer
        from my_skills ms
        where exists (
          select 1 from unnest(coalesce(j.skills_required, '{}')) req
          where lower(req) = ms.skill
        )
      ) as skill_overlap
    from public.jobs j
    join public.job_embeddings je on je.job_id = j.id
    cross join my_embedding me
    where j.status = 'open'
      and j.removed_at is null
      and not exists (
        select 1 from public.job_passes jp
        where jp.talent_id = auth.uid() and jp.job_id = j.id
      )
      and not exists (
        select 1 from public.applications a
        where a.talent_id = auth.uid() and a.job_id = j.id
      )
  ) scored
  order by scored.similarity
         + case when scored.category_match then 0.05 else 0 end
         + least(scored.skill_overlap, 3) * 0.02
         desc
  limit greatest(1, least(match_count, 50));
$$;

revoke execute on function public.match_jobs_for_talent(integer) from public, anon;
grant execute on function public.match_jobs_for_talent(integer) to authenticated;

-- Talent-side saved searches ("job alerts"). New-match counts are computed
-- at read time against last_viewed_at; no cron, no notifications table.
create table public.job_alerts (
  id             uuid default gen_random_uuid() primary key,
  talent_id      uuid references public.profiles(id) on delete cascade not null,
  name           text not null check (char_length(name) between 1 and 80),
  query          text not null default '' check (char_length(query) <= 200),
  filters        jsonb not null default '{}'::jsonb,
  last_viewed_at timestamptz default now() not null,
  created_at     timestamptz default now() not null
);

alter table public.job_alerts enable row level security;

create policy "job_alerts_select_own"
  on public.job_alerts for select
  using (auth.uid() = talent_id);

create policy "job_alerts_insert_own"
  on public.job_alerts for insert
  to authenticated
  with check (auth.uid() = talent_id);

create policy "job_alerts_update_own"
  on public.job_alerts for update
  using (auth.uid() = talent_id)
  with check (auth.uid() = talent_id);

create policy "job_alerts_delete_own"
  on public.job_alerts for delete
  using (auth.uid() = talent_id);

create index if not exists job_alerts_talent_created_idx
  on public.job_alerts(talent_id, created_at desc);
