-- ============================================================
-- Castd.ai — Phase 2: Likes & Views
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- profile_likes: any authenticated user can like a talent profile
-- ============================================================
create table if not exists public.profile_likes (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  talent_id   uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  unique(user_id, talent_id)
);

alter table public.profile_likes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'profile_likes_select_all' and tablename = 'profile_likes'
  ) then
    create policy "profile_likes_select_all"
      on public.profile_likes for select using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'profile_likes_insert_own' and tablename = 'profile_likes'
  ) then
    create policy "profile_likes_insert_own"
      on public.profile_likes for insert with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'profile_likes_delete_own' and tablename = 'profile_likes'
  ) then
    create policy "profile_likes_delete_own"
      on public.profile_likes for delete using (auth.uid() = user_id);
  end if;
end;
$$;

-- ============================================================
-- profile_views: track profile view events
-- ============================================================
create table if not exists public.profile_views (
  id          uuid default gen_random_uuid() primary key,
  viewer_id   uuid references public.profiles(id) on delete cascade null,
  talent_id   uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz default now() not null
);

alter table public.profile_views enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'profile_views_select_all' and tablename = 'profile_views'
  ) then
    create policy "profile_views_select_all"
      on public.profile_views for select using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'profile_views_insert_authenticated' and tablename = 'profile_views'
  ) then
    create policy "profile_views_insert_authenticated"
      on public.profile_views for insert
      to authenticated
      with check (true);
  end if;
end;
$$;

-- ============================================================
-- Update talent_stats view
-- ============================================================
create or replace view public.talent_stats as
select
  p.id as profile_id,
  (select count(*) from public.shortlists where talent_id = p.id) as shortlist_count,
  (select count(*) from public.applications where talent_id = p.id) as application_count,
  (select count(*) from public.credits where profile_id = p.id) as credit_count,
  (select count(*) from public.profile_likes where talent_id = p.id) as likes_count,
  (select count(*) from public.profile_views where talent_id = p.id) as views_count
from public.profiles p
where p.account_type = 'talent';
