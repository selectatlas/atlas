-- ============================================================
-- Atlas — In-app review authoring (two-stage)
-- Adds optional public sub-ratings (communication, reliability,
-- craft) and a private 0-10 recommend score to talent_reviews.
-- All columns are nullable so existing rows and the display
-- components keep working unchanged.
-- ============================================================

alter table public.talent_reviews
  add column if not exists rating_communication smallint
    check (rating_communication is null or rating_communication between 1 and 5),
  add column if not exists rating_reliability smallint
    check (rating_reliability is null or rating_reliability between 1 and 5),
  add column if not exists rating_craft smallint
    check (rating_craft is null or rating_craft between 1 and 5),
  add column if not exists recommend_score smallint
    check (recommend_score is null or recommend_score between 0 and 10);

-- ============================================================
-- recommend_score is private hirer telemetry: strip the blanket
-- table select and re-grant every public column explicitly
-- (same column-grant pattern as profiles in 015). Service role
-- keeps full access for seed and admin surfaces.
-- ============================================================
revoke select on table public.talent_reviews from authenticated, anon;
grant select (
  id, talent_id, reviewer_id, rating, body, project_title, created_at,
  rating_communication, rating_reliability, rating_craft
) on table public.talent_reviews to authenticated;

-- ============================================================
-- Hirer authoring: a hirer may publish a review only as
-- themselves and only for talent they have actually hired
-- (a hired application on one of their own jobs). The policy
-- subqueries run under the caller's RLS, which already scopes
-- applications and jobs to the owning hirer.
-- ============================================================
drop policy if exists "talent_reviews_insert_hirer_hired" on public.talent_reviews;
create policy "talent_reviews_insert_hirer_hired"
  on public.talent_reviews
  for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.talent_id = talent_reviews.talent_id
        and a.status = 'hired'
        and j.hirer_id = auth.uid()
    )
  );
