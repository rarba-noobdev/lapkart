drop policy if exists "admins manage coupon redemptions" on public.coupon_redemptions;
drop policy if exists "coupon redemptions select own" on public.coupon_redemptions;

create policy "coupon redemptions select own or admin"
on public.coupon_redemptions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "admins insert coupon redemptions"
on public.coupon_redemptions
for insert
to authenticated
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins update coupon redemptions"
on public.coupon_redemptions
for update
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins delete coupon redemptions"
on public.coupon_redemptions
for delete
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins manage coupons" on public.coupons;
drop policy if exists "active coupons readable" on public.coupons;

create policy "active coupons readable or admin"
on public.coupons
for select
to authenticated
using (
  active = true
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "admins insert coupons"
on public.coupons
for insert
to authenticated
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins update coupons"
on public.coupons
for update
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins delete coupons"
on public.coupons
for delete
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins manage cancellations" on public.order_cancellation_requests;
drop policy if exists "cancel insert own" on public.order_cancellation_requests;
drop policy if exists "cancel select own" on public.order_cancellation_requests;

create policy "cancellations select own or admin"
on public.order_cancellation_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "cancellations insert own or admin"
on public.order_cancellation_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "admins update cancellations"
on public.order_cancellation_requests
for update
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins delete cancellations"
on public.order_cancellation_requests
for delete
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins manage invoices" on public.order_invoices;
drop policy if exists "invoices select own" on public.order_invoices;

create policy "invoices select own or admin"
on public.order_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_invoices.order_id
      and o.user_id = (select auth.uid())
  )
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "admins insert invoices"
on public.order_invoices
for insert
to authenticated
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins update invoices"
on public.order_invoices
for update
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create policy "admins delete invoices"
on public.order_invoices
for delete
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins view all items" on public.order_items;
drop policy if exists "items select own order" on public.order_items;

create policy "items select own order or admin"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_items.order_id
      and order_row.user_id = (select auth.uid())
  )
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

drop policy if exists "admins view all orders" on public.orders;
drop policy if exists "orders select own" on public.orders;

create policy "orders select own or admin"
on public.orders
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);
