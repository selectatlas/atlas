-- ============================================================
-- Atlas — Talent trust layer: reviews, verification, proof-of-work
-- ============================================================

-- ============================================================
-- Fix stale credits.category check (009 widened talent_skills and
-- jobs to include photographer_videographer but missed credits)
-- ============================================================
alter table public.credits drop constraint if exists credits_category_check;
alter table public.credits add constraint credits_category_check
  check (category in ('dancer', 'actor', 'photographer_videographer', 'content_creator'));

-- ============================================================
-- Proof-of-work columns
-- ============================================================
alter table public.credits
  add column if not exists outcome text check (outcome is null or char_length(outcome) <= 280),
  add column if not exists client_logo_url text;

alter table public.portfolio_items
  add column if not exists role text check (role is null or char_length(role) <= 80),
  add column if not exists project_date date,
  add column if not exists outcome text check (outcome is null or char_length(outcome) <= 280);

-- ============================================================
-- Verification (public badge — lives on profiles so cards and the
-- detail hero can read it through the column-grant allowlist)
-- ============================================================
alter table public.profiles
  add column if not exists verified_at timestamptz,
  add column if not exists verified_categories text[] not null default '{}';

grant select (verified_at, verified_categories) on table public.profiles to authenticated;

-- Verification is server-managed: only seed + admin routes (service role)
-- may write it. Same enforcement boundary as id/email/account_type (004).
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
    and (
      new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.account_type is distinct from old.account_type
      or new.verified_at is distinct from old.verified_at
      or new.verified_categories is distinct from old.verified_categories
    )
  then
    raise exception 'Profile identity fields are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Response time (seeded stat; talent_profiles is service-role only)
-- ============================================================
alter table public.talent_profiles
  add column if not exists response_time_hours smallint
    check (response_time_hours is null or response_time_hours between 1 and 168);

-- ============================================================
-- Talent reviews (seeded by service role; hirer submission can be
-- enabled later with an insert policy, no schema change needed)
-- ============================================================
create table if not exists public.talent_reviews (
  id            uuid default gen_random_uuid() primary key,
  talent_id     uuid references public.profiles(id) on delete cascade not null,
  reviewer_id   uuid references public.profiles(id) on delete set null,
  rating        smallint not null check (rating between 1 and 5),
  body          text not null check (char_length(body) between 1 and 2000),
  project_title text check (project_title is null or char_length(project_title) <= 140),
  created_at    timestamptz default now() not null
);

alter table public.talent_reviews enable row level security;

drop policy if exists "talent_reviews_select_authenticated" on public.talent_reviews;
create policy "talent_reviews_select_authenticated"
  on public.talent_reviews
  for select
  to authenticated
  using (true);

create index if not exists talent_reviews_talent_created_idx
  on public.talent_reviews(talent_id, created_at desc);

-- ============================================================
-- Extend talent_stats with review aggregates (append-only columns)
-- ============================================================
create or replace view public.talent_stats as
select
  p.id as profile_id,
  (select count(*) from public.shortlists where talent_id = p.id) as shortlist_count,
  (select count(*) from public.applications where talent_id = p.id) as application_count,
  (select count(*) from public.credits where profile_id = p.id) as credit_count,
  (select count(*) from public.profile_likes where talent_id = p.id) as likes_count,
  (select count(*) from public.profile_views where talent_id = p.id) as views_count,
  (select count(*) from public.talent_reviews where talent_id = p.id) as review_count,
  (select round(avg(rating)::numeric, 2) from public.talent_reviews where talent_id = p.id) as avg_rating
from public.profiles p
where p.account_type = 'talent';

grant select on public.talent_stats to authenticated;
