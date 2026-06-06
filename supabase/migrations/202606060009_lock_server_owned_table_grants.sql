-- Browser clients should not have direct DML privileges on service-owned commerce tables.
-- RLS remains the row-level guard for SELECT; service-role Edge Functions own mutations.

revoke insert, update, delete, truncate, references, trigger
on table
  public.orders,
  public.order_items,
  public.payments,
  public.checkout_sessions,
  public.shipments,
  public.shipment_packages,
  public.shipment_events,
  public.admin_order_events,
  public.admin_user_events,
  public.user_roles
from anon, authenticated;

grant select on table
  public.orders,
  public.order_items,
  public.shipments,
  public.shipment_packages,
  public.shipment_events,
  public.user_roles
to authenticated;

grant select (
  id,
  order_id,
  provider,
  status,
  amount,
  provider_order_id,
  provider_payment_id,
  created_at
) on public.payments to authenticated;

grant select on table public.checkout_sessions to authenticated;
grant select on table public.admin_order_events, public.admin_user_events to authenticated;

comment on table public.orders is
  'Paid checkout orders are inserted by backend service role only after payment/COD validation. Browser clients retain SELECT through RLS but no direct DML privileges.';
