alter table public.products
  drop column if exists vendor_id,
  drop column if exists category_id;

alter table public.orders
  drop column if exists vendor_id,
  drop column if exists delivery_partner_id;

drop table if exists public.carts;
drop table if exists public.wishlists;
drop table if exists public.reviews;
drop table if exists public.notifications;
drop table if exists public.invoices;
drop table if exists public.delivery_partners;
drop table if exists public.vendors;
drop table if exists public.categories;

drop type if exists public.vendor_status;
drop type if exists public.order_status;

drop extension if exists postgis;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
on storage.objects
for select
using (bucket_id in ('products', 'users'));
