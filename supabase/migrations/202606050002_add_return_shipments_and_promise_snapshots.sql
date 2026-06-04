alter table public.shipments
  add column if not exists shipping_direction text not null default 'outbound',
  add column if not exists return_request_id uuid references public.return_requests(id) on delete set null;

alter table public.orders
  add column if not exists delivery_promise_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shipments_shipping_direction_chk'
      and conrelid = 'public.shipments'::regclass
  ) then
    alter table public.shipments
      add constraint shipments_shipping_direction_chk
      check (shipping_direction in ('outbound', 'return'));
  end if;
end $$;

create index if not exists shipments_return_request_id_idx
  on public.shipments(return_request_id)
  where return_request_id is not null;

create index if not exists shipments_direction_status_idx
  on public.shipments(shipping_direction, status, created_at desc);

alter table public.return_requests
  drop constraint if exists return_requests_status_check;

alter table public.return_requests
  add constraint return_requests_status_check
  check (status in (
    'pending',
    'approved',
    'reverse_pickup_scheduled',
    'refund_pending',
    'received',
    'refunded',
    'rejected',
    'closed'
  ));

alter table public.shipping_batches
  drop constraint if exists shipping_batches_type_chk;

alter table public.shipping_batches
  add constraint shipping_batches_type_chk
  check (batch_type in (
    'create_orders',
    'assign_awb',
    'schedule_pickup',
    'generate_labels',
    'generate_manifest',
    'generate_invoice',
    'cancel_shipments',
    'refresh_tracking'
  ));
