alter table public.orders
  add column if not exists shipping_service_type text not null default 'standard'
  check (shipping_service_type in ('standard', 'quick'));

alter table public.shipments
  add column if not exists shipping_service_type text not null default 'standard'
  check (shipping_service_type in ('standard', 'quick'));
