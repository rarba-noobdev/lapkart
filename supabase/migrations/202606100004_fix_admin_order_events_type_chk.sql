-- admin_cancel_order() inserts admin_order_events rows with
-- event_type = 'admin_cancelled_order', but the check constraint only allowed
-- the manual editor's event types. Every admin cancellation therefore rolled
-- back with a constraint violation while the Shiprocket shipment (cancelled
-- outside the transaction) was already gone. Widen the constraint to cover the
-- RPC's event type.

alter table public.admin_order_events
  drop constraint if exists admin_order_events_type_chk;

alter table public.admin_order_events
  add constraint admin_order_events_type_chk check (
    event_type in (
      'manual_update',
      'manual_cancel',
      'workflow_action',
      'address_update',
      'payment_update',
      'shipping_update',
      'admin_cancelled_order'
    )
  );
