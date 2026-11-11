-- Original files (PDFs) kept beside their text, so sources can be shown as their real pages on every device.
-- A private bucket with one folder per user: `originals/<user id>/<doc id>.pdf`. Only you can read or change yours.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('originals', 'originals', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "originals: read own"   on storage.objects;
drop policy if exists "originals: add own"    on storage.objects;
drop policy if exists "originals: update own" on storage.objects;
drop policy if exists "originals: delete own" on storage.objects;

create policy "originals: read own" on storage.objects for select to authenticated
  using (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "originals: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "originals: update own" on storage.objects for update to authenticated
  using (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "originals: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
