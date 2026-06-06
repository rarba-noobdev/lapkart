-- Manual storage hardening script.
--
-- Supabase MCP apply_migration cannot currently replace policies on storage.objects
-- for this project because the migration role is not the owner of that relation.
-- Apply this from the Supabase SQL editor or another owner-level migration path.

update storage.buckets
set public = false
where id in ('users', 'vendors', 'invoices', 'repair_requests');

update storage.buckets
set public = true
where id in ('products', 'product-images', 'reviews');

drop policy if exists "public read product images" on storage.objects;
drop policy if exists "authenticated upload user files" on storage.objects;
drop policy if exists "owners update own storage objects" on storage.objects;
drop policy if exists "owners delete own storage objects" on storage.objects;
drop policy if exists "storage public read catalog media" on storage.objects;
drop policy if exists "storage users read own private files" on storage.objects;
drop policy if exists "storage users upload own private files" on storage.objects;
drop policy if exists "storage users update own private files" on storage.objects;
drop policy if exists "storage users delete own private files" on storage.objects;

create policy "storage public read catalog media"
on storage.objects
for select
to public
using (bucket_id in ('products', 'product-images', 'reviews'));

create policy "storage users read own private files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "storage users upload own private files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "storage users update own private files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "storage users delete own private files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on policy "storage public read catalog media" on storage.objects is
  'Only catalog/review media buckets are publicly readable. User, invoice, vendor, and support buckets remain private.';
