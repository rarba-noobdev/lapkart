-- Avoid invoking admin helper functions for anonymous catalog reads.
-- The previous combined policy evaluated public.is_admin() for anon requests,
-- which caused permission denied for GET / when loading active products.

drop policy if exists "products public read active" on public.products;

create policy "products public read active"
on public.products
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "admins read all products" on public.products;
create policy "admins read all products"
on public.products
for select
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));

comment on policy "products public read active" on public.products is
  'Anonymous and customer catalog reads are limited to active products and do not call admin helper functions.';

comment on policy "admins read all products" on public.products is
  'Authenticated admins can read draft/archived products through a separate policy.';
