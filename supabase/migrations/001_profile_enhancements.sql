-- ============================================================
-- Castd.ai — Phase 1: Profile Enhancements
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- New columns on profiles
-- ============================================================
alter table public.profiles
  add column if not exists headline text,
  add column if not exists cover_url text;

-- ============================================================
-- Credits / Work History
-- ============================================================
create table if not exists public.credits (
  id           uuid default gen_random_uuid() primary key,
  profile_id   uuid references public.profiles(id) on delete cascade not null,
  title        text not null,
  production   text not null,
  company      text,
  start_date   date,
  end_date     date,
  description  text,
  media_url    text,
  category     text check (category in ('dancer', 'actor', 'content_creator')),
  sort_order   int default 0,
  created_at   timestamptz default now() not null
);

alter table public.credits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'credits_select_all' and tablename = 'credits'
  ) then
    create policy "credits_select_all"
      on public.credits for select using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'credits_manage_own' and tablename = 'credits'
  ) then
    create policy "credits_manage_own"
      on public.credits for all using (auth.uid() = profile_id);
  end if;
end;
$$;

-- ============================================================
-- Portfolio Items (multiple media beyond single showreel URL)
-- ============================================================
create table if not exists public.portfolio_items (
  id            uuid default gen_random_uuid() primary key,
  profile_id    uuid references public.profiles(id) on delete cascade not null,
  type          text not null check (type in ('video', 'image', 'link')),
  url           text not null,
  title         text,
  description   text,
  thumbnail_url text,
  sort_order    int default 0,
  created_at    timestamptz default now() not null
);

alter table public.portfolio_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'portfolio_select_all' and tablename = 'portfolio_items'
  ) then
    create policy "portfolio_select_all"
      on public.portfolio_items for select using (true);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'portfolio_manage_own' and tablename = 'portfolio_items'
  ) then
    create policy "portfolio_manage_own"
      on public.portfolio_items for all using (auth.uid() = profile_id);
  end if;
end;
$$;

-- ============================================================
-- Talent Stats View (only create if it doesn't exist yet —
-- migration 002 will update it with likes/views counts)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_views
    where viewname = 'talent_stats' and schemaname = 'public'
  ) then
    create view public.talent_stats as
    select
      p.id as profile_id,
      (select count(*) from public.shortlists where talent_id = p.id) as shortlist_count,
      (select count(*) from public.applications where talent_id = p.id) as application_count,
      (select count(*) from public.credits where profile_id = p.id) as credit_count
    from public.profiles p
    where p.account_type = 'talent';
  end if;
end;
$$;

-- ============================================================
-- Storage: covers bucket
-- Run in: Supabase Dashboard > Storage > New Bucket > "covers" (public)
-- Then run the policies below:
-- ============================================================

-- Allow any authenticated user to upload to covers (scoped by user folder)
-- create policy "covers_insert_own"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read
-- create policy "covers_select_public"
--   on storage.objects for select
--   using (bucket_id = 'covers');

-- Allow users to delete their own cover uploads
-- create policy "covers_delete_own"
--   on storage.objects for delete
--   to authenticated
--   using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
