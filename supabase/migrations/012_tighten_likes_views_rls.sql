-- Tighten profile_likes and profile_views RLS: stop exposing cross-user rows via PostgREST.

drop policy if exists "profile_likes_select_all" on public.profile_likes;
create policy "profile_likes_select_own"
  on public.profile_likes for select
  using (auth.uid() = user_id or auth.uid() = talent_id);

drop policy if exists "profile_views_select_all" on public.profile_views;
create policy "profile_views_select_talent"
  on public.profile_views for select
  using (auth.uid() = talent_id);

drop policy if exists "profile_views_insert_authenticated" on public.profile_views;
create policy "profile_views_insert_own"
  on public.profile_views for insert
  to authenticated
  with check (viewer_id = auth.uid());
