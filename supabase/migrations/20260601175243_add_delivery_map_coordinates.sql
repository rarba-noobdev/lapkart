alter table public.orders
  add column if not exists shipping_latitude double precision,
  add column if not exists shipping_longitude double precision,
  add column if not exists shipping_location_source text;

alter table public.addresses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_source text;

alter table public.orders
  drop constraint if exists orders_shipping_latitude_chk,
  add constraint orders_shipping_latitude_chk check (
    shipping_latitude is null or (shipping_latitude >= -90 and shipping_latitude <= 90)
  ),
  drop constraint if exists orders_shipping_longitude_chk,
  add constraint orders_shipping_longitude_chk check (
    shipping_longitude is null or (shipping_longitude >= -180 and shipping_longitude <= 180)
  );

alter table public.addresses
  drop constraint if exists addresses_latitude_chk,
  add constraint addresses_latitude_chk check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  drop constraint if exists addresses_longitude_chk,
  add constraint addresses_longitude_chk check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  );
