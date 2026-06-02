alter table public.orders
  add column if not exists shipping_courier_company_id integer,
  add column if not exists shipping_courier_name text,
  add column if not exists shipping_expected_delivery_date date,
  add column if not exists shipping_charge_estimate numeric(12,2);

alter table public.orders
  drop constraint if exists orders_shipping_charge_estimate_chk,
  add constraint orders_shipping_charge_estimate_chk check (
    shipping_charge_estimate is null or shipping_charge_estimate >= 0
  );
