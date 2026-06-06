-- Advisor cleanup after hardening migrations.
-- SECURITY DEFINER helper/trigger functions must not be callable through REST
-- by anon/authenticated roles. Trigger execution does not require REST execute.

revoke all on function public.has_role(uuid, app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, app_role) to service_role;

revoke all on function public.admin_cancel_order(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_cancel_order(uuid, uuid, text, jsonb) to service_role;

revoke all on function public.prevent_order_snapshot_mutation() from public, anon, authenticated;
revoke all on function public.prevent_order_item_snapshot_mutation() from public, anon, authenticated;
revoke all on function public.prevent_payment_snapshot_mutation() from public, anon, authenticated;
revoke all on function public.prevent_audit_event_mutation() from public, anon, authenticated;

create index if not exists provider_webhook_events_related_order_id_idx
  on public.provider_webhook_events (related_order_id);
create index if not exists provider_webhook_events_related_shipment_id_idx
  on public.provider_webhook_events (related_shipment_id);
create index if not exists inventory_movements_order_item_id_idx
  on public.inventory_movements (order_item_id);

drop policy if exists "notification outbox select own in app" on public.notification_outbox;
drop policy if exists "admins select notification outbox" on public.notification_outbox;
create policy "notification outbox select own or admin"
on public.notification_outbox
for select
to authenticated
using (
  (user_id = (select auth.uid()) and channel = 'in_app')
  or (select public.is_admin())
);
