alter table public.orders
  add column if not exists shipping_place_id text,
  add column if not exists shipping_formatted_address text,
  add column if not exists shipping_route_distance_meters integer,
  add column if not exists shipping_route_duration_seconds integer,
  add column if not exists shipping_estimate jsonb not null default '{}'::jsonb;

alter table public.addresses
  add column if not exists ola_place_id text,
  add column if not exists formatted_address text;

alter table public.orders
  drop constraint if exists orders_shipping_route_distance_chk,
  add constraint orders_shipping_route_distance_chk check (
    shipping_route_distance_meters is null or shipping_route_distance_meters >= 0
  ),
  drop constraint if exists orders_shipping_route_duration_chk,
  add constraint orders_shipping_route_duration_chk check (
    shipping_route_duration_seconds is null or shipping_route_duration_seconds >= 0
  );
