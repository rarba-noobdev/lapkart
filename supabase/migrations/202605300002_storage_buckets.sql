insert into storage.buckets (id, name, public) values
  ('products', 'products', true),
  ('users', 'users', true),
  ('vendors', 'vendors', false),
  ('invoices', 'invoices', false),
  ('reviews', 'reviews', true),
  ('repair_requests', 'repair_requests', false)
on conflict (id) do nothing;

create policy "public read product images" on storage.objects for select using (bucket_id in ('products', 'reviews', 'users'));
create policy "authenticated upload user files" on storage.objects for insert with check (auth.role() = 'authenticated');
create policy "owners update own storage objects" on storage.objects for update using (owner = auth.uid());
create policy "owners delete own storage objects" on storage.objects for delete using (owner = auth.uid());
