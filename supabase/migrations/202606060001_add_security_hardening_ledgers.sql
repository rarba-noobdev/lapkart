-- Add backend-owned ledgers used by RBAC/order hardening.
-- These tables are additive so existing checkout/admin flows keep working while
-- service code is moved from direct updates to audited transition functions.

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  event_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notification_outbox is
  'Backend-owned retryable notification outbox. User-facing in-app rows are readable by the owning user; delivery mutations are service-owned.';
comment on column public.notification_outbox.payload is
  'Structured delivery payload. Do not store provider secrets or raw payment signatures.';

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('razorpay', 'shiprocket', 'ola_maps')),
  provider_event_id text,
  event_type text not null,
  signature_valid boolean not null default false,
  idempotency_key text not null,
  related_order_id uuid references public.orders(id) on delete set null,
  related_shipment_id uuid references public.shipments(id) on delete set null,
  payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint provider_webhook_events_provider_key_unique unique (provider, idempotency_key)
);

comment on table public.provider_webhook_events is
  'Provider webhook idempotency ledger. Edge Functions insert before processing Razorpay, Shiprocket, or Ola callback payloads.';
comment on column public.provider_webhook_events.idempotency_key is
  'Stable provider-scoped key used to ignore duplicate callbacks and retries.';

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  movement_type text not null check (movement_type in (
    'admin_adjustment',
    'reservation',
    'reservation_release',
    'sale_commit',
    'cancel_release',
    'return_received',
    'damage_writeoff'
  )),
  qty_delta integer not null check (qty_delta <> 0),
  reason text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.inventory_movements is
  'Append-only stock movement ledger for checkout, cancellation, return, and admin adjustments.';
comment on column public.inventory_movements.qty_delta is
  'Positive values add available stock; negative values consume or reserve stock.';

alter table public.notification_outbox enable row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.inventory_movements enable row level security;

create index if not exists notification_outbox_user_status_idx
  on public.notification_outbox (user_id, status, created_at desc);
create index if not exists notification_outbox_order_idx
  on public.notification_outbox (order_id);
create index if not exists notification_outbox_next_attempt_idx
  on public.notification_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

create index if not exists provider_webhook_events_related_order_idx
  on public.provider_webhook_events (provider, related_order_id, received_at desc);
create index if not exists provider_webhook_events_related_shipment_idx
  on public.provider_webhook_events (provider, related_shipment_id, received_at desc);
create index if not exists provider_webhook_events_processing_idx
  on public.provider_webhook_events (processing_status, received_at desc);

create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);
create index if not exists inventory_movements_order_idx
  on public.inventory_movements (order_id, created_at desc);
create index if not exists inventory_movements_actor_idx
  on public.inventory_movements (actor_user_id, created_at desc);

drop policy if exists "notification outbox select own in app" on public.notification_outbox;
create policy "notification outbox select own in app"
on public.notification_outbox
for select
to authenticated
using (
  user_id = (select auth.uid())
  and channel = 'in_app'
);

drop policy if exists "admins select notification outbox" on public.notification_outbox;
create policy "admins select notification outbox"
on public.notification_outbox
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "admins select provider webhook events" on public.provider_webhook_events;
create policy "admins select provider webhook events"
on public.provider_webhook_events
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "admins select inventory movements" on public.inventory_movements;
create policy "admins select inventory movements"
on public.inventory_movements
for select
to authenticated
using ((select public.is_admin()));

grant select on public.notification_outbox to authenticated;
grant select on public.provider_webhook_events to authenticated;
grant select on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.notification_outbox to service_role;
grant select, insert, update, delete on public.provider_webhook_events to service_role;
grant select, insert on public.inventory_movements to service_role;

do $$
begin
  if to_regproc('public.set_updated_at') is not null then
    drop trigger if exists notification_outbox_set_updated_at on public.notification_outbox;
    create trigger notification_outbox_set_updated_at
    before update on public.notification_outbox
    for each row execute function public.set_updated_at();
  end if;
end $$;
