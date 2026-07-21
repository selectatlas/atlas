-- Public talent browsing: anonymous visitors can browse a reduced talent
-- marketplace (Upwork-style hire pages) without a session. The full profile
-- page (/talent/{id}) stays authenticated - this view is the teaser tier.
-- Profiles and talent_skills stay closed to anon; this view is the one
-- window, same trust model as public_open_jobs (026).

-- Owner-rights view on purpose (bypasses RLS): the WHERE clause and the
-- explicit column list ARE the security boundary. Exposed: card display
-- fields only. Deliberately withheld: email (never public), bio, showreel,
-- credits, reviews - those are the "sign up to see the full profile" tier.
-- Row filter: talent accounts only, never suspended, only self-chosen
-- 'public' visibility ('members' means signed-in members only), and only
-- onboarded profiles (headline + at least one skill via the inner join -
-- mirrors needsOnboarding()).
create or replace view public.public_talent_profiles as
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.headline,
    p.city,
    p.country,
    p.rates,
    p.availability,
    p.verified_at,
    p.created_at,
    coalesce(array_agg(distinct ts.category), '{}') as categories,
    coalesce(array_agg(distinct ts.skill), '{}')    as skills,
    lower(
      coalesce(p.full_name, '') || ' ' || coalesce(p.headline, '') || ' ' ||
      coalesce(p.city, '') || ' ' || coalesce(p.country, '') || ' ' ||
      coalesce(string_agg(distinct ts.skill, ' '), '')
    ) as search_text
  from public.profiles p
  join public.talent_skills ts on ts.profile_id = p.id
  where p.account_type = 'talent'
    and p.suspended_at is null
    and p.profile_visibility = 'public'
    and p.headline is not null
  group by p.id;

comment on view public.public_talent_profiles is
  'Anon-facing talent marketplace projection. Owner-rights on purpose (bypasses RLS): the WHERE clause and column list are the security boundary. Full profiles stay behind auth.';

-- RLS bounds rows; grants bound verbs (030). The view is read-only surface:
-- select only, to both anon (public marketplace) and authenticated (signed-in
-- hirers browsing the same page).
grant select on public.public_talent_profiles to anon, authenticated;
