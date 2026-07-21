-- Storage for talent portfolio images. Until now the only buckets were
-- avatars and covers, so a talent could not upload work samples at all -
-- portfolio_items could only hold pasted external URLs.
--
-- Images only. Video stays URL-based (YouTube/Vimeo) because streaming,
-- transcoding and bandwidth are not problems worth owning here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read: portfolio images appear on public talent profiles and in
-- search cards, the same visibility avatars and covers already have.
drop policy if exists "portfolio_media_select_public" on storage.objects;
create policy "portfolio_media_select_public"
  on storage.objects for select
  using (bucket_id = 'portfolio');

-- Writes are confined to a folder named for the caller's own uid, so one
-- talent can never write into another's portfolio.
drop policy if exists "portfolio_media_insert_own" on storage.objects;
create policy "portfolio_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "portfolio_media_update_own" on storage.objects;
create policy "portfolio_media_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'portfolio'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'portfolio'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "portfolio_media_delete_own" on storage.objects;
create policy "portfolio_media_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolio'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
  );
