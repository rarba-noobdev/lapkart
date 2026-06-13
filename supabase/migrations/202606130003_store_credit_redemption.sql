-- Makes store credit spendable. Credit is debited atomically inside the same
-- transaction that creates the order, so an order can never be created with the
-- payable reduced by credit that was not actually consumed (and vice versa).

alter table public.orders
  add column if not exists store_credit_applied numeric not null default 0;

-- The prepaid flow persists the checkout summary in checkout_sessions and
-- replays it at payment completion, so the applied credit must survive there.
alter table public.checkout_sessions
  add column if not exists store_credit_applied numeric not null default 0;

-- FIFO consume (soonest-to-expire first). Returns the amount actually taken,
-- which may be less than requested if the live balance changed. Called only
-- from complete_checkout_payment (service-role / definer context).
create or replace function public.consume_store_credit(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_remaining numeric := coalesce(p_amount, 0);
  v_row record;
  v_take numeric;
begin
  if v_remaining <= 0 then return 0; end if;
  for v_row in
    select id, balance
    from public.store_credits
    where user_id = p_user_id
      and balance > 0
      and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_row.balance, v_remaining);
    update public.store_credits set balance = balance - v_take where id = v_row.id;
    v_remaining := v_remaining - v_take;
  end loop;
  return coalesce(p_amount, 0) - v_remaining;
end;
$$;

revoke all on function public.consume_store_credit(uuid, numeric) from public, anon, authenticated;

-- Recreate the checkout completion RPC with a store-credit parameter. Body is
-- unchanged except: the orders insert now records store_credit_applied, and the
-- credit is consumed after the payment row is written.
drop function if exists public.complete_checkout_payment(
  uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, text
);

create or replace function public.complete_checkout_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_order_payload jsonb,
  p_items jsonb,
  p_payment_payload jsonb,
  p_address_payload jsonb,
  p_save_address boolean,
  p_checkout_session_razorpay_order_id text,
  p_store_credit_applied numeric default 0
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
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
    id, user_id, status, payment_status, payment_method,
    subtotal, shipping, discount_total, total, cod_fee, store_credit_applied,
    cod_confirmed, rto_risk, hold_reason, coupon_id, coupon_code,
    shipping_name, shipping_phone, shipping_email, shipping_address,
    shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_pincode,
    shipping_country, shipping_latitude, shipping_longitude, shipping_location_source,
    shipping_place_id, shipping_formatted_address, shipping_route_distance_meters,
    shipping_route_duration_seconds, shipping_estimate, delivery_promise_snapshot,
    shipping_courier_company_id, shipping_courier_name, shipping_service_type,
    shipping_expected_delivery_date, shipping_charge_estimate, tracking
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
    coalesce((p_order_payload->>'cod_fee')::numeric, 0),
    coalesce(p_store_credit_applied, 0),
    coalesce((p_order_payload->>'cod_confirmed')::boolean, false),
    coalesce((p_order_payload->>'rto_risk')::integer, 0),
    nullif(p_order_payload->>'hold_reason', ''),
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
    order_id, product_id, title, image, brand, price, unit_price, qty,
    cost_price_snapshot, selling_price_snapshot, line_margin_snapshot, compat_acknowledged
  )
  select
    p_order_id,
    (item->>'product_id')::uuid,
    item->>'title',
    item->>'image',
    item->>'brand',
    (item->>'price')::numeric,
    (item->>'unit_price')::numeric,
    (item->>'qty')::integer,
    coalesce(product.cost_price, 0),
    coalesce(product.selling_price, product.price, (item->>'unit_price')::numeric),
    round((coalesce((item->>'unit_price')::numeric, product.selling_price, product.price, 0) - coalesce(product.cost_price, 0)) * (item->>'qty')::integer, 2),
    coalesce((item->>'compat_acknowledged')::boolean, false)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  left join public.products product on product.id = (item->>'product_id')::uuid;

  insert into public.payments (
    order_id, provider, method, amount, status,
    provider_order_id, provider_payment_id, provider_signature, raw_payload
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

  -- Spend store credit (FIFO by expiry) inside this transaction.
  if coalesce(p_store_credit_applied, 0) > 0 then
    perform public.consume_store_credit(p_user_id, p_store_credit_applied);
  end if;

  if p_save_address
    and nullif(btrim(coalesce(p_address_payload->>'line1', '')), '') is not null
    and not exists (
      select 1
      from public.addresses a
      where a.user_id = p_user_id
        and lower(btrim(coalesce(a.full_name, ''))) = lower(btrim(coalesce(p_address_payload->>'full_name', '')))
        and btrim(coalesce(a.phone, '')) = btrim(coalesce(p_address_payload->>'phone', ''))
        and lower(btrim(coalesce(a.line1, ''))) = lower(btrim(coalesce(p_address_payload->>'line1', '')))
        and lower(btrim(coalesce(a.line2, ''))) = lower(btrim(coalesce(p_address_payload->>'line2', '')))
        and lower(btrim(coalesce(a.city, ''))) = lower(btrim(coalesce(p_address_payload->>'city', '')))
        and lower(btrim(coalesce(a.state, ''))) = lower(btrim(coalesce(p_address_payload->>'state', '')))
        and btrim(coalesce(a.pincode, '')) = btrim(coalesce(p_address_payload->>'pincode', ''))
    )
  then
    insert into public.addresses (
      user_id, full_name, phone, line1, line2, city, state, pincode,
      latitude, longitude, location_source, ola_place_id, formatted_address, is_default
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
$function$;
