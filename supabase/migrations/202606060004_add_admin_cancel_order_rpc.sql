-- Backend-enforced admin cancellation workflow.
-- The Edge Function must authenticate the caller and pass its verified admin
-- user id. This RPC is only executable by service_role to prevent callers from
-- spoofing another admin id through direct browser RPC calls.

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_role(_user_id, _role);
$$;

revoke all on function public.has_role(uuid, app_role) from public;
grant execute on function public.has_role(uuid, app_role) to authenticated, service_role;

comment on function public.has_role(uuid, app_role) is
  'Policy-safe public wrapper around the private role helper. Uses SECURITY DEFINER with an explicit search path.';

create or replace function public.admin_cancel_order(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_order public.orders%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_cancel_request_id uuid;
  v_refund_id uuid;
  v_locked_shipment public.shipments%rowtype;
  v_item record;
  v_next_payment_status text;
  v_cancel_request_status text;
begin
  if p_admin_user_id is null or not public.has_role(p_admin_user_id, 'admin'::app_role) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'CANCELLATION_REASON_REQUIRED';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status in (
    'cancelled',
    'delivered',
    'return_requested',
    'return_approved',
    'return_received',
    'returned',
    'refunded'
  ) then
    raise exception 'ORDER_CANCELLATION_NOT_ALLOWED';
  end if;

  if v_order.payment_status in ('refunded', 'partially_refunded') then
    raise exception 'ORDER_CANCELLATION_PAYMENT_LOCKED';
  end if;

  select *
  into v_locked_shipment
  from public.shipments
  where order_id = p_order_id
    and shipping_direction = 'outbound'
    and (
      status in (
        'pickup_scheduled',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'rto_initiated',
        'rto_in_transit',
        'rto_delivered',
        'lost',
        'damaged',
        'closed',
        'label_generated'
      )
      or (
        awb_code is not null
        and status not in ('pending', 'created', 'create_failed', 'cancelled')
      )
    )
  order by created_at desc
  limit 1
  for update;

  if found then
    raise exception 'ORDER_CANCELLATION_SHIPMENT_LOCKED';
  end if;

  v_before := jsonb_build_object(
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'total', v_order.total
  );

  v_next_payment_status := case
    when v_order.payment_status = 'cod_pending' then 'cod_cancelled'
    else v_order.payment_status
  end;

  update public.orders
  set
    status = 'cancelled',
    payment_status = v_next_payment_status,
    updated_at = now()
  where id = v_order.id
  returning status, payment_status, total
  into v_order.status, v_order.payment_status, v_order.total;

  v_cancel_request_status := case
    when v_order.payment_status = 'paid' then 'refund_pending'
    else 'closed'
  end;

  select id
  into v_cancel_request_id
  from public.order_cancellation_requests
  where order_id = p_order_id
    and status in ('pending', 'refund_pending')
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.order_cancellation_requests
    set
      status = v_cancel_request_status,
      admin_note = p_reason,
      resolved_at = now(),
      updated_at = now()
    where id = v_cancel_request_id;
  else
    insert into public.order_cancellation_requests (
      order_id,
      user_id,
      status,
      reason,
      admin_note,
      resolved_at
    )
    values (
      p_order_id,
      v_order.user_id,
      v_cancel_request_status,
      btrim(p_reason),
      btrim(p_reason),
      now()
    )
    returning id into v_cancel_request_id;
  end if;

  if v_order.payment_status = 'paid' then
    select id
    into v_refund_id
    from public.refunds
    where order_id = p_order_id
      and cancellation_request_id = v_cancel_request_id
      and status in ('pending', 'created', 'processing')
    order by created_at desc
    limit 1
    for update;

    if v_refund_id is null then
      insert into public.refunds (
        order_id,
        payment_id,
        cancellation_request_id,
        amount,
        status,
        reason,
        requested_by,
        raw_payload
      )
      values (
        p_order_id,
        (select id from public.payments where order_id = p_order_id order by created_at desc limit 1),
        v_cancel_request_id,
        v_order.total,
        'pending',
        btrim(p_reason),
        p_admin_user_id,
        jsonb_build_object('source', 'admin_cancel_order')
      )
      returning id into v_refund_id;
    end if;

    update public.order_cancellation_requests
    set refund_id = v_refund_id, updated_at = now()
    where id = v_cancel_request_id;
  end if;

  for v_item in
    select id, product_id, qty
    from public.order_items
    where order_id = p_order_id
  loop
    update public.products
    set stock = stock + v_item.qty
    where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id,
      order_id,
      order_item_id,
      movement_type,
      qty_delta,
      reason,
      actor_user_id,
      metadata
    )
    values (
      v_item.product_id,
      p_order_id,
      v_item.id,
      'cancel_release',
      v_item.qty,
      btrim(p_reason),
      p_admin_user_id,
      jsonb_build_object('source', 'admin_cancel_order')
    );
  end loop;

  v_after := jsonb_build_object(
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'cancellation_request_id', v_cancel_request_id,
    'refund_id', v_refund_id
  );

  insert into public.admin_order_events (
    order_id,
    admin_user_id,
    event_type,
    reason,
    from_state,
    to_state,
    metadata
  )
  values (
    p_order_id,
    p_admin_user_id,
    'admin_cancelled_order',
    btrim(p_reason),
    v_before,
    v_after,
    coalesce(p_metadata, '{}'::jsonb)
  );

  insert into public.notification_outbox (
    user_id,
    order_id,
    channel,
    event_type,
    title,
    body,
    payload
  )
  values (
    v_order.user_id,
    p_order_id,
    'in_app',
    'order_cancelled',
    'Order cancelled',
    'Your LapKart order was cancelled. Refund details will be updated separately if payment was already captured.',
    jsonb_build_object(
      'order_id', p_order_id,
      'cancellation_request_id', v_cancel_request_id,
      'refund_id', v_refund_id,
      'reason', btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'status', v_order.status,
    'paymentStatus', v_order.payment_status,
    'cancellationRequestId', v_cancel_request_id,
    'refundId', v_refund_id
  );
end;
$$;

revoke all on function public.admin_cancel_order(uuid, uuid, text, jsonb) from public;
grant execute on function public.admin_cancel_order(uuid, uuid, text, jsonb) to service_role;

comment on function public.admin_cancel_order(uuid, uuid, text, jsonb) is
  'Service-role admin cancellation workflow. Locks order/shipments, blocks shipment-locked cancellations, writes audit, notification outbox, optional refund row, and stock release movements.';
