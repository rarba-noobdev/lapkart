create index if not exists addresses_user_id_idx on public.addresses(user_id);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists shipments_pickup_location_id_idx on public.shipments(pickup_location_id);
