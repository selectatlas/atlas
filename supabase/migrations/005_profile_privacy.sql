-- Keep private identity data out of all browser and cross-user profile reads.
-- The current user's email is available from Supabase Auth and does not need to
-- be readable from public.profiles.

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS controls rows, not columns. Column grants are the enforcement boundary
-- that prevents an authenticated caller from asking PostgREST for email.
revoke select on table public.profiles from anon, authenticated;

grant select (
  id,
  account_type,
  full_name,
  avatar_url,
  cover_url,
  headline,
  city,
  country,
  bio,
  rates,
  availability,
  showreel_url,
  created_at
) on table public.profiles to authenticated;
