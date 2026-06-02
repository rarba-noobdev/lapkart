create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.has_role(uuid, public.app_role) set schema private;
revoke all on function private.has_role(uuid, public.app_role) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;

alter policy "users view own roles"
on public.user_roles
to authenticated
using ((select auth.uid()) = user_id);

alter policy "admins view all roles"
on public.user_roles
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "profiles select own"
on public.profiles
to authenticated
using ((select auth.uid()) = id);

alter policy "profiles update own"
on public.profiles
to authenticated
using ((select auth.uid()) = id);

alter policy "profiles insert own"
on public.profiles
to authenticated
with check ((select auth.uid()) = id);

alter policy "admins manage products"
on public.products
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "addr select own"
on public.addresses
to authenticated
using ((select auth.uid()) = user_id);

alter policy "addr insert own"
on public.addresses
to authenticated
with check ((select auth.uid()) = user_id);

alter policy "addr update own"
on public.addresses
to authenticated
using ((select auth.uid()) = user_id);

alter policy "addr delete own"
on public.addresses
to authenticated
using ((select auth.uid()) = user_id);

alter policy "orders select own"
on public.orders
to authenticated
using ((select auth.uid()) = user_id);

alter policy "orders insert own"
on public.orders
to authenticated
with check ((select auth.uid()) = user_id);

alter policy "admins view all orders"
on public.orders
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "items select own order"
on public.order_items
to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "items insert own order"
on public.order_items
to authenticated
with check (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "admins view all items"
on public.order_items
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "payments select own order"
on public.payments
to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "payments insert own order"
on public.payments
to authenticated
with check (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "admins manage shipping pickup locations"
on public.shipping_pickup_locations
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "admins manage shipments"
on public.shipments
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "users view own shipments"
on public.shipments
to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "admins manage shipment packages"
on public.shipment_packages
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "users view own shipment packages"
on public.shipment_packages
to authenticated
using (
  exists (
    select 1
    from public.shipments shipment_row
    join public.orders order_row on order_row.id = shipment_row.order_id
    where shipment_row.id = shipment_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "admins manage shipment events"
on public.shipment_events
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "users view own shipment events"
on public.shipment_events
to authenticated
using (
  exists (
    select 1
    from public.shipments shipment_row
    join public.orders order_row on order_row.id = shipment_row.order_id
    where shipment_row.id = shipment_id
      and order_row.user_id = (select auth.uid())
  )
);

alter policy "admins manage shipping batches"
on public.shipping_batches
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

alter policy "admins manage shipping batch items"
on public.shipping_batch_items
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
