-- =============================================================================
-- 0005  Storage buckets
-- =============================================================================
-- Media lives in Supabase Storage, not in Git. See ADR 0002.
--
--   campaign-media   public   hero images, team galleries, event photos/videos
--   archive-media    public   imported historical media (read-only in practice)
--   avatars          public   agent profile pictures not supplied by Google
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('campaign-media', 'campaign-media', true, 209715200),  -- 200 MB
  ('archive-media',  'archive-media',  true, 524288000),  -- 500 MB: the 2020 package
                                                          -- contains a 185 MB video
  ('avatars',        'avatars',        true, 5242880)     -- 5 MB
on conflict (id) do nothing;

-- Anyone may look at the exhibit.
create policy "public read campaign-media" on storage.objects
  for select using (bucket_id = 'campaign-media');
create policy "public read archive-media" on storage.objects
  for select using (bucket_id = 'archive-media');
create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

-- Signed-in agents may upload into the active campaign's folder.
create policy "authenticated upload campaign-media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campaign-media');

create policy "authenticated upload avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- You may replace or remove only what you uploaded.
create policy "owner manage campaign-media" on storage.objects
  for update to authenticated using (bucket_id = 'campaign-media' and owner = auth.uid());
create policy "owner delete campaign-media" on storage.objects
  for delete to authenticated using (bucket_id = 'campaign-media' and owner = auth.uid());

-- The archive is immutable. Only an admin (service role / is_admin) writes to it,
-- which is what makes an archived campaign trustworthy years later.
create policy "admin write archive-media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'archive-media' and public.is_admin());
