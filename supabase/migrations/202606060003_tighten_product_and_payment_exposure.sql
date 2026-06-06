-- Tighten browser-facing read surfaces.
-- RLS controls rows; column privileges are needed for payment secrets because
-- RLS cannot hide individual columns like provider_signature/raw_payload.

drop policy if exists "products public read" on public.products;
create policy "products public read active"
on public.products
for select
to anon, authenticated
using (
  status = 'active'
  or (select public.is_admin())
);

comment on policy "products public read active" on public.products is
  'Anonymous and customer catalog reads are limited to active products. Admins can read all product statuses.';

revoke select on public.payments from authenticated;
grant select (
  id,
  order_id,
  provider,
  method,
  amount,
  status,
  provider_order_id,
  provider_payment_id,
  created_at
) on public.payments to authenticated;

grant select, insert, update, delete on public.payments to service_role;

comment on column public.payments.provider_signature is
  'Sensitive provider verification value. Do not grant this column to browser-facing roles.';
comment on column public.payments.raw_payload is
  'Raw payment provider payload. Service-role only; may contain sensitive provider data.';
