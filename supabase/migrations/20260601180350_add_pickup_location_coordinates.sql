alter table public.shipping_pickup_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.shipping_pickup_locations
  drop constraint if exists shipping_pickup_locations_latitude_chk,
  add constraint shipping_pickup_locations_latitude_chk check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  drop constraint if exists shipping_pickup_locations_longitude_chk,
  add constraint shipping_pickup_locations_longitude_chk check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  );
