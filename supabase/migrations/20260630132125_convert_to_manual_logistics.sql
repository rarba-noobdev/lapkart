begin;

alter table if exists public.shipping_pickup_locations
  drop constraint if exists shipping_pickup_locations_provider_chk;
alter table if exists public.shipments
  drop constraint if exists shipments_provider_chk;
alter table if exists public.shipment_events
  drop constraint if exists shipment_events_provider_chk;
alter table if exists public.shipping_batches
  drop constraint if exists shipping_batches_provider_chk;
alter table if exists public.provider_webhook_events
  drop constraint if exists provider_webhook_events_provider_check;

update public.shipping_pickup_locations
set provider = 'manual'
where provider = concat('ship', 'rocket');

update public.shipments
set provider = 'manual'
where provider = concat('ship', 'rocket');

update public.shipment_events
set provider = 'manual'
where provider = concat('ship', 'rocket');

update public.shipping_batches
set provider = 'manual'
where provider = concat('ship', 'rocket');

update public.provider_webhook_events
set provider = 'manual'
where provider = concat('ship', 'rocket');

do $$
declare
  legacy_order_column text := concat('ship', 'rocket_order_id');
  legacy_shipment_column text := concat('ship', 'rocket_shipment_id');
  legacy_reference_column text := concat('ship', 'rocket_channel_order_id');
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments' and column_name = legacy_order_column
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments' and column_name = 'provider_order_id'
  ) then
    execute format('alter table public.shipments rename column %I to provider_order_id', legacy_order_column);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments' and column_name = legacy_shipment_column
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments' and column_name = 'provider_shipment_id'
  ) then
    execute format('alter table public.shipments rename column %I to provider_shipment_id', legacy_shipment_column);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments' and column_name = legacy_reference_column
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shipments' and column_name = 'provider_reference_id'
  ) then
    execute format(
      'alter table public.shipments rename column %I to provider_reference_id',
      legacy_reference_column
    );
  end if;

  execute format(
    'drop index if exists public.%I',
    concat('shipments_ship', 'rocket_order_id_idx')
  );
  execute format(
    'drop index if exists public.%I',
    concat('shipments_ship', 'rocket_shipment_id_idx')
  );
end $$;

alter table public.shipping_pickup_locations alter column provider set default 'manual';
alter table public.shipments alter column provider set default 'manual';
alter table public.shipment_events alter column provider set default 'manual';
alter table public.shipping_batches alter column provider set default 'manual';

alter table public.shipping_pickup_locations
  add constraint shipping_pickup_locations_provider_chk check (provider = 'manual');
alter table public.shipments
  add constraint shipments_provider_chk check (provider = 'manual');
alter table public.shipment_events
  add constraint shipment_events_provider_chk check (provider = 'manual');
alter table public.shipping_batches
  add constraint shipping_batches_provider_chk check (provider = 'manual');
alter table public.provider_webhook_events
  add constraint provider_webhook_events_provider_check
  check (provider in ('razorpay', 'manual', 'ola_maps'));

create unique index if not exists shipments_provider_order_id_idx
  on public.shipments(provider, provider_order_id)
  where provider_order_id is not null;

create unique index if not exists shipments_provider_shipment_id_idx
  on public.shipments(provider, provider_shipment_id)
  where provider_shipment_id is not null;

delete from public.feature_flags
where key = concat('ship', 'rocket');

comment on table public.shipping_pickup_locations is
  'Pickup locations used by LapKart staff for manual fulfillment.';
comment on table public.shipments is
  'Manual shipment records linked to LapKart orders, including AWB, courier, labels, and status.';
comment on table public.shipment_packages is
  'Package dimensions and declared value recorded for manual fulfillment.';
comment on table public.shipment_events is
  'Shipment status history entered or imported by LapKart staff.';
comment on table public.shipping_batches is
  'Audit records for bulk manual fulfillment actions.';

commit;
