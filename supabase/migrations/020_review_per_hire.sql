-- ============================================================
-- Atlas — One review per hire
-- 018 let any hirer with a single hired application insert an
-- unlimited number of reviews for that talent (only the API rate
-- limit stood in the way), which inflates avg_rating/review_count
-- on the talent profile. Rebuild the insert policy so the number
-- of reviews a hirer can publish for a talent never exceeds the
-- number of hired applications they have with that talent.
--
-- A unique (reviewer_id, talent_id) constraint is deliberately
-- NOT used: repeat bookings legitimately produce repeat reviews
-- (the seeded demo world includes one), and the service role
-- seed path must stay unaffected.
-- ============================================================

drop policy if exists "talent_reviews_insert_hirer_hired" on public.talent_reviews;
create policy "talent_reviews_insert_hirer_hired"
  on public.talent_reviews
  for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and (
      select count(*)
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.talent_id = talent_reviews.talent_id
        and a.status = 'hired'
        and j.hirer_id = auth.uid()
    ) > (
      select count(*)
      from public.talent_reviews existing
      where existing.talent_id = talent_reviews.talent_id
        and existing.reviewer_id = auth.uid()
    )
  );
