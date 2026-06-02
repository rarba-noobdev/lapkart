-- Shiprocket/logistics schema for multi-order fulfillment.
-- Credentials stay in backend environment variables, not in database tables.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.orders
  add column if not exists shipping_email text,
  add column if not exists shipping_line1 text,
  add column if not exists shipping_line2 text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_pincode text,
  add column if not exists shipping_country text not null default 'India';

alter table public.orders
  drop constraint if exists orders_shipping_pincode_format_chk,
  add constraint orders_shipping_pincode_format_chk
    check (shipping_pincode is null or shipping_pincode ~ '^[0-9]{6}$');

alter table public.products
  add column if not exists weight_kg numeric(10,3),
  add column if not exists length_cm numeric(10,2),
  add column if not exists breadth_cm numeric(10,2),
  add column if not exists height_cm numeric(10,2);

alter table public.products
  drop constraint if exists products_package_measurements_chk,
  add constraint products_package_measurements_chk check (
    (weight_kg is null or weight_kg > 0) and
    (length_cm is null or length_cm > 0) and
    (breadth_cm is null or breadth_cm > 0) and
    (height_cm is null or height_cm > 0)
  );

create table if not exists public.shipping_pickup_locations (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'shiprocket',
  provider_location_id text,
  pickup_location text not null,
  contact_name text,
  phone text not null,
  email text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shipping_pickup_locations_provider_chk check (provider in ('shiprocket')),
  constraint shipping_pickup_locations_pincode_chk check (pincode ~ '^[0-9]{6}$'),
  constraint shipping_pickup_locations_unique_name unique (provider, pickup_location)
);

create unique index if not exists shipping_pickup_locations_one_default_idx
  on public.shipping_pickup_locations(provider)
  where is_default and is_active;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'shiprocket',
  pickup_location_id uuid references public.shipping_pickup_locations(id) on delete set null,
  shipment_number integer not null default 1,

  status text not null default 'pending',
  shiprocket_order_id bigint,
  shiprocket_shipment_id bigint,
  shiprocket_channel_order_id text,
  awb_code text,
  courier_company_id integer,
  courier_name text,

  pickup_scheduled_date date,
  expected_delivery_date date,
  actual_delivery_at timestamptz,
  tracking_url text,
  label_url text,
  manifest_url text,
  invoice_url text,

  shipping_charge numeric(12,2),
  cod_amount numeric(12,2) not null default 0,
  billed_weight_kg numeric(10,3),
  applied_weight_kg numeric(10,3),

  last_status_code integer,
  last_status_at timestamptz,
  error_code text,
  error_message text,

  request_payload jsonb not null default '{}'::jsonb,
  raw_create_response jsonb not null default '{}'::jsonb,
  raw_awb_response jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shipments_provider_chk check (provider in ('shiprocket')),
  constraint shipments_number_chk check (shipment_number > 0),
  constraint shipments_status_chk check (status in (
    'pending',
    'created',
    'awb_assigned',
    'pickup_scheduled',
    'label_generated',
    'manifest_generated',
    'invoiced',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'returned',
    'rto_initiated',
    'rto_delivered',
    'lost',
    'damaged',
    'failed'
  )),
  constraint shipments_cod_amount_chk check (cod_amount >= 0),
  constraint shipments_shipping_charge_chk check (shipping_charge is null or shipping_charge >= 0),
  constraint shipments_billed_weight_chk check (billed_weight_kg is null or billed_weight_kg > 0),
  constraint shipments_applied_weight_chk check (applied_weight_kg is null or applied_weight_kg > 0),
  constraint shipments_unique_order_number unique (order_id, shipment_number)
);

create unique index if not exists shipments_shiprocket_order_id_idx
  on public.shipments(provider, shiprocket_order_id)
  where shiprocket_order_id is not null;

create unique index if not exists shipments_shiprocket_shipment_id_idx
  on public.shipments(provider, shiprocket_shipment_id)
  where shiprocket_shipment_id is not null;

create unique index if not exists shipments_awb_code_idx
  on public.shipments(provider, awb_code)
  where awb_code is not null;

create index if not exists shipments_order_id_idx on public.shipments(order_id);
create index if not exists shipments_status_idx on public.shipments(status);
create index if not exists shipments_last_status_at_idx on public.shipments(last_status_at desc);

create table if not exists public.shipment_packages (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  package_number integer not null default 1,
  weight_kg numeric(10,3) not null,
  length_cm numeric(10,2) not null,
  breadth_cm numeric(10,2) not null,
  height_cm numeric(10,2) not null,
  declared_value numeric(12,2) not null default 0,
  item_count integer not null default 1,
  sku_summary text,
  order_item_ids uuid[] not null default '{}'::uuid[],
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shipment_packages_package_number_chk check (package_number > 0),
  constraint shipment_packages_weight_chk check (weight_kg > 0),
  constraint shipment_packages_dimensions_chk check (length_cm > 0 and breadth_cm > 0 and height_cm > 0),
  constraint shipment_packages_declared_value_chk check (declared_value >= 0),
  constraint shipment_packages_item_count_chk check (item_count > 0),
  constraint shipment_packages_unique_number unique (shipment_id, package_number)
);

create index if not exists shipment_packages_shipment_id_idx on public.shipment_packages(shipment_id);

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipments(id) on delete cascade,
  provider text not null default 'shiprocket',
  awb_code text,
  status text not null,
  status_code integer,
  status_time timestamptz,
  location text,
  message text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),

  constraint shipment_events_provider_chk check (provider in ('shiprocket'))
);

create index if not exists shipment_events_shipment_id_idx on public.shipment_events(shipment_id, received_at desc);
create index if not exists shipment_events_awb_code_idx on public.shipment_events(provider, awb_code, received_at desc);
create index if not exists shipment_events_status_code_idx on public.shipment_events(status_code);

create table if not exists public.shipping_batches (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'shiprocket',
  batch_type text not null,
  status text not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  total_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  label_url text,
  manifest_url text,
  invoice_url text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shipping_batches_provider_chk check (provider in ('shiprocket')),
  constraint shipping_batches_type_chk check (batch_type in (
    'create_orders',
    'assign_awb',
    'schedule_pickup',
    'generate_labels',
    'generate_manifest',
    'generate_invoice',
    'cancel_shipments'
  )),
  constraint shipping_batches_status_chk check (status in (
    'pending',
    'processing',
    'completed',
    'partially_failed',
    'failed',
    'cancelled'
  )),
  constraint shipping_batches_counts_chk check (
    total_count >= 0 and success_count >= 0 and failure_count >= 0 and success_count + failure_count <= total_count
  )
);

create index if not exists shipping_batches_status_idx on public.shipping_batches(status, created_at desc);
create index if not exists shipping_batches_requested_by_idx on public.shipping_batches(requested_by, created_at desc);

create table if not exists public.shipping_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.shipping_batches(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  shipment_id uuid references public.shipments(id) on delete set null,
  status text not null default 'pending',
  provider_reference text,
  error_message text,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shipping_batch_items_status_chk check (status in ('pending', 'processing', 'completed', 'failed', 'skipped'))
);

create index if not exists shipping_batch_items_batch_id_idx on public.shipping_batch_items(batch_id);
create index if not exists shipping_batch_items_order_id_idx on public.shipping_batch_items(order_id);
create index if not exists shipping_batch_items_shipment_id_idx on public.shipping_batch_items(shipment_id);

create trigger shipping_pickup_locations_set_updated_at
  before update on public.shipping_pickup_locations
  for each row execute function public.set_updated_at();

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

create trigger shipment_packages_set_updated_at
  before update on public.shipment_packages
  for each row execute function public.set_updated_at();

create trigger shipping_batches_set_updated_at
  before update on public.shipping_batches
  for each row execute function public.set_updated_at();

create trigger shipping_batch_items_set_updated_at
  before update on public.shipping_batch_items
  for each row execute function public.set_updated_at();

alter table public.shipping_pickup_locations enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_packages enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipping_batches enable row level security;
alter table public.shipping_batch_items enable row level security;

create policy "admins manage shipping pickup locations"
  on public.shipping_pickup_locations
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "admins manage shipments"
  on public.shipments
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "users view own shipments"
  on public.shipments
  for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = shipments.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "admins manage shipment packages"
  on public.shipment_packages
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "users view own shipment packages"
  on public.shipment_packages
  for select
  using (
    exists (
      select 1
      from public.shipments s
      join public.orders o on o.id = s.order_id
      where s.id = shipment_packages.shipment_id
        and o.user_id = auth.uid()
    )
  );

create policy "admins manage shipment events"
  on public.shipment_events
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "users view own shipment events"
  on public.shipment_events
  for select
  using (
    exists (
      select 1
      from public.shipments s
      join public.orders o on o.id = s.order_id
      where s.id = shipment_events.shipment_id
        and o.user_id = auth.uid()
    )
  );

create policy "admins manage shipping batches"
  on public.shipping_batches
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "admins manage shipping batch items"
  on public.shipping_batch_items
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.shipping_pickup_locations is 'Shiprocket pickup locations configured by admins. Does not store API credentials.';
comment on table public.shipments is 'Provider shipment records linked to LapKart orders. Stores Shiprocket IDs, AWB, courier, labels, and status.';
comment on table public.shipment_packages is 'Package dimensions and declared value used when creating Shiprocket shipments.';
comment on table public.shipment_events is 'Tracking and webhook events from logistics providers.';
comment on table public.shipping_batches is 'Admin bulk fulfillment jobs for multiple orders or shipments.';
comment on table public.shipping_batch_items is 'Per-order/per-shipment result rows for a bulk fulfillment job.';
