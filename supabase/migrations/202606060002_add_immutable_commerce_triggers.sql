-- Make financially important commerce snapshots immutable after creation.
-- Status/payment-status/tracking changes remain possible and should move
-- through dedicated transition functions in later migrations.

create or replace function public.prevent_order_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id is distinct from new.user_id then raise exception 'ORDER_USER_IMMUTABLE'; end if;
  if old.payment_method is distinct from new.payment_method then raise exception 'ORDER_PAYMENT_METHOD_IMMUTABLE'; end if;
  if old.subtotal is distinct from new.subtotal then raise exception 'ORDER_SUBTOTAL_IMMUTABLE'; end if;
  if old.shipping is distinct from new.shipping then raise exception 'ORDER_SHIPPING_IMMUTABLE'; end if;
  if old.discount_total is distinct from new.discount_total then raise exception 'ORDER_DISCOUNT_IMMUTABLE'; end if;
  if old.total is distinct from new.total then raise exception 'ORDER_TOTAL_IMMUTABLE'; end if;
  if old.coupon_id is distinct from new.coupon_id then raise exception 'ORDER_COUPON_IMMUTABLE'; end if;
  if old.coupon_code is distinct from new.coupon_code then raise exception 'ORDER_COUPON_CODE_IMMUTABLE'; end if;
  if old.shipping_name is distinct from new.shipping_name then raise exception 'ORDER_SHIPPING_NAME_IMMUTABLE'; end if;
  if old.shipping_phone is distinct from new.shipping_phone then raise exception 'ORDER_SHIPPING_PHONE_IMMUTABLE'; end if;
  if old.shipping_email is distinct from new.shipping_email then raise exception 'ORDER_SHIPPING_EMAIL_IMMUTABLE'; end if;
  if old.shipping_address is distinct from new.shipping_address then raise exception 'ORDER_SHIPPING_ADDRESS_IMMUTABLE'; end if;
  if old.shipping_line1 is distinct from new.shipping_line1 then raise exception 'ORDER_SHIPPING_LINE1_IMMUTABLE'; end if;
  if old.shipping_line2 is distinct from new.shipping_line2 then raise exception 'ORDER_SHIPPING_LINE2_IMMUTABLE'; end if;
  if old.shipping_city is distinct from new.shipping_city then raise exception 'ORDER_SHIPPING_CITY_IMMUTABLE'; end if;
  if old.shipping_state is distinct from new.shipping_state then raise exception 'ORDER_SHIPPING_STATE_IMMUTABLE'; end if;
  if old.shipping_pincode is distinct from new.shipping_pincode then raise exception 'ORDER_SHIPPING_PINCODE_IMMUTABLE'; end if;
  if old.shipping_country is distinct from new.shipping_country then raise exception 'ORDER_SHIPPING_COUNTRY_IMMUTABLE'; end if;
  if old.shipping_latitude is distinct from new.shipping_latitude then raise exception 'ORDER_SHIPPING_LATITUDE_IMMUTABLE'; end if;
  if old.shipping_longitude is distinct from new.shipping_longitude then raise exception 'ORDER_SHIPPING_LONGITUDE_IMMUTABLE'; end if;
  if old.shipping_location_source is distinct from new.shipping_location_source then raise exception 'ORDER_SHIPPING_LOCATION_SOURCE_IMMUTABLE'; end if;
  if old.shipping_place_id is distinct from new.shipping_place_id then raise exception 'ORDER_SHIPPING_PLACE_ID_IMMUTABLE'; end if;
  if old.shipping_formatted_address is distinct from new.shipping_formatted_address then raise exception 'ORDER_SHIPPING_FORMATTED_ADDRESS_IMMUTABLE'; end if;
  if old.shipping_route_distance_meters is distinct from new.shipping_route_distance_meters then raise exception 'ORDER_SHIPPING_ROUTE_DISTANCE_IMMUTABLE'; end if;
  if old.shipping_route_duration_seconds is distinct from new.shipping_route_duration_seconds then raise exception 'ORDER_SHIPPING_ROUTE_DURATION_IMMUTABLE'; end if;
  if old.shipping_estimate is distinct from new.shipping_estimate then raise exception 'ORDER_SHIPPING_ESTIMATE_IMMUTABLE'; end if;
  if old.shipping_courier_company_id is distinct from new.shipping_courier_company_id then raise exception 'ORDER_SHIPPING_COURIER_ID_IMMUTABLE'; end if;
  if old.shipping_courier_name is distinct from new.shipping_courier_name then raise exception 'ORDER_SHIPPING_COURIER_NAME_IMMUTABLE'; end if;
  if old.shipping_expected_delivery_date is distinct from new.shipping_expected_delivery_date then raise exception 'ORDER_SHIPPING_EXPECTED_DELIVERY_IMMUTABLE'; end if;
  if old.shipping_charge_estimate is distinct from new.shipping_charge_estimate then raise exception 'ORDER_SHIPPING_CHARGE_ESTIMATE_IMMUTABLE'; end if;
  if old.shipping_service_type is distinct from new.shipping_service_type then raise exception 'ORDER_SHIPPING_SERVICE_TYPE_IMMUTABLE'; end if;
  if old.delivery_promise_snapshot is distinct from new.delivery_promise_snapshot then raise exception 'ORDER_DELIVERY_PROMISE_IMMUTABLE'; end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_order_snapshot_mutation on public.orders;
create trigger trg_prevent_order_snapshot_mutation
before update on public.orders
for each row execute function public.prevent_order_snapshot_mutation();

comment on function public.prevent_order_snapshot_mutation() is
  'Rejects direct changes to immutable order totals, identity, address, courier, route, and promise snapshots.';

create or replace function public.prevent_order_item_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ORDER_ITEM_DELETE_BLOCKED';
  end if;

  if old.order_id is distinct from new.order_id then raise exception 'ORDER_ITEM_ORDER_IMMUTABLE'; end if;
  if old.product_id is distinct from new.product_id then raise exception 'ORDER_ITEM_PRODUCT_IMMUTABLE'; end if;
  if old.title is distinct from new.title then raise exception 'ORDER_ITEM_TITLE_IMMUTABLE'; end if;
  if old.image is distinct from new.image then raise exception 'ORDER_ITEM_IMAGE_IMMUTABLE'; end if;
  if old.brand is distinct from new.brand then raise exception 'ORDER_ITEM_BRAND_IMMUTABLE'; end if;
  if old.price is distinct from new.price then raise exception 'ORDER_ITEM_PRICE_IMMUTABLE'; end if;
  if old.unit_price is distinct from new.unit_price then raise exception 'ORDER_ITEM_UNIT_PRICE_IMMUTABLE'; end if;
  if old.qty is distinct from new.qty then raise exception 'ORDER_ITEM_QTY_IMMUTABLE'; end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_order_item_snapshot_mutation on public.order_items;
create trigger trg_prevent_order_item_snapshot_mutation
before update or delete on public.order_items
for each row execute function public.prevent_order_item_snapshot_mutation();

comment on function public.prevent_order_item_snapshot_mutation() is
  'Rejects direct changes/deletes to server-owned order item product, quantity, and price snapshots.';

create or replace function public.prevent_payment_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'PAYMENT_DELETE_BLOCKED';
  end if;

  if old.order_id is distinct from new.order_id then raise exception 'PAYMENT_ORDER_IMMUTABLE'; end if;
  if old.provider is distinct from new.provider then raise exception 'PAYMENT_PROVIDER_IMMUTABLE'; end if;
  if old.method is distinct from new.method then raise exception 'PAYMENT_METHOD_IMMUTABLE'; end if;
  if old.amount is distinct from new.amount then raise exception 'PAYMENT_AMOUNT_IMMUTABLE'; end if;
  if old.provider_order_id is distinct from new.provider_order_id then raise exception 'PAYMENT_PROVIDER_ORDER_IMMUTABLE'; end if;
  if old.provider_payment_id is distinct from new.provider_payment_id then raise exception 'PAYMENT_PROVIDER_PAYMENT_IMMUTABLE'; end if;
  if old.provider_signature is distinct from new.provider_signature then raise exception 'PAYMENT_PROVIDER_SIGNATURE_IMMUTABLE'; end if;
  if old.raw_payload is distinct from new.raw_payload then raise exception 'PAYMENT_RAW_PAYLOAD_IMMUTABLE'; end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_payment_snapshot_mutation on public.payments;
create trigger trg_prevent_payment_snapshot_mutation
before update or delete on public.payments
for each row execute function public.prevent_payment_snapshot_mutation();

comment on function public.prevent_payment_snapshot_mutation() is
  'Rejects direct changes/deletes to payment provider identity, amount, signature, and raw payload snapshots.';

create or replace function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'AUDIT_EVENT_IMMUTABLE';
end;
$$;

drop trigger if exists trg_prevent_admin_order_event_mutation on public.admin_order_events;
create trigger trg_prevent_admin_order_event_mutation
before update or delete on public.admin_order_events
for each row execute function public.prevent_audit_event_mutation();

drop trigger if exists trg_prevent_admin_user_event_mutation on public.admin_user_events;
create trigger trg_prevent_admin_user_event_mutation
before update or delete on public.admin_user_events
for each row execute function public.prevent_audit_event_mutation();

comment on function public.prevent_audit_event_mutation() is
  'Makes admin audit tables append-only. Corrections must be written as new audit events.';
