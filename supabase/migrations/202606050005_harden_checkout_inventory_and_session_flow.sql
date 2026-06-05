begin;

create or replace function public.complete_checkout_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_order_payload jsonb,
  p_items jsonb,
  p_payment_payload jsonb,
  p_address_payload jsonb,
  p_save_address boolean,
  p_checkout_session_razorpay_order_id text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_requested_count integer := 0;
  v_reserved_count integer := 0;
begin
  with requested as (
    select
      (item->>'product_id')::uuid as product_id,
      sum((item->>'qty')::integer) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    group by 1
  )
  select count(*) into v_requested_count from requested;

  if v_requested_count = 0 then
    raise exception 'Checkout items are required';
  end if;

  with requested as (
    select
      (item->>'product_id')::uuid as product_id,
      sum((item->>'qty')::integer) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    group by 1
  ),
  reserved as (
    update public.products as product
    set stock = product.stock - requested.qty,
        updated_at = now()
    from requested
    where product.id = requested.product_id
      and product.stock >= requested.qty
    returning product.id
  )
  select count(*) into v_reserved_count from reserved;

  if v_reserved_count <> v_requested_count then
    raise exception 'Insufficient stock for one or more checkout items';
  end if;

  insert into public.orders (
    id,
    user_id,
    status,
    payment_status,
    payment_method,
    subtotal,
    shipping,
    discount_total,
    total,
    coupon_id,
    coupon_code,
    shipping_name,
    shipping_phone,
    shipping_email,
    shipping_address,
    shipping_line1,
    shipping_line2,
    shipping_city,
    shipping_state,
    shipping_pincode,
    shipping_country,
    shipping_latitude,
    shipping_longitude,
    shipping_location_source,
    shipping_place_id,
    shipping_formatted_address,
    shipping_route_distance_meters,
    shipping_route_duration_seconds,
    shipping_estimate,
    delivery_promise_snapshot,
    shipping_courier_company_id,
    shipping_courier_name,
    shipping_service_type,
    shipping_expected_delivery_date,
    shipping_charge_estimate,
    tracking
  ) values (
    p_order_id,
    p_user_id,
    coalesce(p_order_payload->>'status', 'confirmed'),
    coalesce(p_order_payload->>'payment_status', 'paid'),
    coalesce(p_order_payload->>'payment_method', 'razorpay'),
    (p_order_payload->>'subtotal')::numeric,
    (p_order_payload->>'shipping')::numeric,
    coalesce((p_order_payload->>'discount_total')::numeric, 0),
    (p_order_payload->>'total')::numeric,
    nullif(p_order_payload->>'coupon_id', '')::uuid,
    nullif(p_order_payload->>'coupon_code', ''),
    p_order_payload->>'shipping_name',
    p_order_payload->>'shipping_phone',
    p_order_payload->>'shipping_email',
    p_order_payload->>'shipping_address',
    p_order_payload->>'shipping_line1',
    p_order_payload->>'shipping_line2',
    p_order_payload->>'shipping_city',
    p_order_payload->>'shipping_state',
    p_order_payload->>'shipping_pincode',
    coalesce(p_order_payload->>'shipping_country', 'India'),
    (p_order_payload->>'shipping_latitude')::numeric,
    (p_order_payload->>'shipping_longitude')::numeric,
    p_order_payload->>'shipping_location_source',
    p_order_payload->>'shipping_place_id',
    p_order_payload->>'shipping_formatted_address',
    (p_order_payload->>'shipping_route_distance_meters')::integer,
    (p_order_payload->>'shipping_route_duration_seconds')::integer,
    coalesce(p_order_payload->'shipping_estimate', '{}'::jsonb),
    coalesce(p_order_payload->'delivery_promise_snapshot', '{}'::jsonb),
    (p_order_payload->>'shipping_courier_company_id')::integer,
    p_order_payload->>'shipping_courier_name',
    coalesce(p_order_payload->>'shipping_service_type', 'standard'),
    (p_order_payload->>'shipping_expected_delivery_date')::date,
    (p_order_payload->>'shipping_charge_estimate')::numeric,
    coalesce(p_order_payload->'tracking', '[]'::jsonb)
  );

  insert into public.order_items (
    order_id,
    product_id,
    title,
    image,
    brand,
    price,
    unit_price,
    qty
  )
  select
    p_order_id,
    (item->>'product_id')::uuid,
    item->>'title',
    item->>'image',
    item->>'brand',
    (item->>'price')::numeric,
    (item->>'unit_price')::numeric,
    (item->>'qty')::integer
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item;

  insert into public.payments (
    order_id,
    provider,
    method,
    amount,
    status,
    provider_order_id,
    provider_payment_id,
    provider_signature,
    raw_payload
  ) values (
    p_order_id,
    coalesce(p_payment_payload->>'provider', 'razorpay'),
    p_payment_payload->>'method',
    (p_payment_payload->>'amount')::numeric,
    coalesce(p_payment_payload->>'status', 'paid'),
    p_payment_payload->>'provider_order_id',
    p_payment_payload->>'provider_payment_id',
    p_payment_payload->>'provider_signature',
    coalesce(p_payment_payload->'raw_payload', '{}'::jsonb)
  );

  if p_save_address then
    insert into public.addresses (
      user_id,
      full_name,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      latitude,
      longitude,
      location_source,
      ola_place_id,
      formatted_address,
      is_default
    ) values (
      p_user_id,
      p_address_payload->>'full_name',
      p_address_payload->>'phone',
      p_address_payload->>'line1',
      p_address_payload->>'line2',
      p_address_payload->>'city',
      p_address_payload->>'state',
      p_address_payload->>'pincode',
      (p_address_payload->>'latitude')::numeric,
      (p_address_payload->>'longitude')::numeric,
      p_address_payload->>'location_source',
      p_address_payload->>'ola_place_id',
      p_address_payload->>'formatted_address',
      true
    );
  end if;

  update public.checkout_sessions
  set status = 'paid',
      order_id = p_order_id,
      updated_at = now()
  where razorpay_order_id = p_checkout_session_razorpay_order_id
    and status in ('pending', 'processing');

  if not found then
    raise exception 'Checkout session is not available for completion';
  end if;

  return p_order_id;
end;
$$;

revoke all on function public.complete_checkout_payment(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, text) from public;
revoke all on function public.complete_checkout_payment(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, text) from anon;
revoke all on function public.complete_checkout_payment(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, text) from authenticated;
grant execute on function public.complete_checkout_payment(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, text) to service_role;

comment on function public.complete_checkout_payment(uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, text) is
  'Atomically finalizes a paid checkout, reserves inventory, writes the order/payment records, and closes the server-owned checkout session.';

commit;
