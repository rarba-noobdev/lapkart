drop policy if exists "admins read all products" on public.products;
drop policy if exists "products public read active" on public.products;

create policy "anon read active products"
on public.products
for select
to anon
using (status = 'active');

create policy "authenticated read visible products"
on public.products
for select
to authenticated
using (
	status = 'active'
	or (
		select private.has_role((select auth.uid()), 'admin'::app_role)
	)
);
