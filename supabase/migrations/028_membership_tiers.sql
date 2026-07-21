-- ============================================================
-- Atlas - Talent membership tiers (client pricing table, 20 Jul 2026).
-- Free / Gold / Platinum gate media allowances, package counts,
-- weekly application caps and transaction fees. The allowance
-- numbers live in src/lib/membership.ts (one config object) -
-- the database only records which tier a profile is on.
-- Admin-settable only in this phase: no self-serve upgrade, no
-- billing. Tier changes go through admin routes (service role),
-- so no UPDATE grant is added for authenticated users.
-- ============================================================

alter table public.profiles
  add column if not exists membership_tier text not null default 'free'
  check (membership_tier in ('free', 'gold', 'platinum'));

comment on column public.profiles.membership_tier is
  'Talent membership tier (free/gold/platinum). Allowances derived in src/lib/membership.ts; admin-set via service role, never by the user directly.';

-- profiles SELECT is column-allowlisted (005); new columns are invisible
-- until granted. Tier is member-visible display data (platinum badge,
-- preview caps). Profiles stay closed to anon (005/026 convention).
grant select (membership_tier) on table public.profiles to authenticated;
