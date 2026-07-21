-- A talent can now present either a single wide cover photo (the existing
-- behaviour, unchanged by default) or a three-up grid.
--
-- cover_images is deliberately separate from portfolio_items: a cover is a
-- curated first impression, and chaining it to portfolio sort order would mean
-- reordering your work silently rewrites the top of your profile.
--
-- cover_url is kept as-is rather than folded into the array. It is read by
-- search cards, job covers and OG image generation; migrating those to an
-- array would be a wide change for no gain, so single-cover stays the
-- canonical one-image field and cover_images backs the grid layout.

alter table public.profiles
  add column if not exists cover_images text[] not null default '{}',
  add column if not exists cover_layout text not null default 'single';

-- Two supported layouts. A check constraint rather than an enum so adding a
-- layout later is a one-line change instead of a type migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_cover_layout_check'
  ) then
    alter table public.profiles
      add constraint profiles_cover_layout_check
      check (cover_layout in ('single', 'grid'));
  end if;
end $$;

-- The grid renders exactly three tiles; storing more would silently drop them.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_cover_images_max_check'
  ) then
    alter table public.profiles
      add constraint profiles_cover_images_max_check
      check (array_length(cover_images, 1) is null or array_length(cover_images, 1) <= 3);
  end if;
end $$;

-- profiles SELECT is column-allowlisted (005); new columns are invisible until
-- granted. Profiles stay closed to anon (005/026/028 convention) - the public
-- talent surface reads through the public_talent_profiles view (031), not this
-- table, so anon gets nothing here.
grant select (cover_images, cover_layout) on table public.profiles to authenticated;
-- 005 grants UPDATE on the table to authenticated and RLS pins it to
-- auth.uid() = id, so a talent editing their own cover is already covered.
