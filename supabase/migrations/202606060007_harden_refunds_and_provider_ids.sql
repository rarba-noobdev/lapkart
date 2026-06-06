-- Keep refund/provider records financially safe even if a future service endpoint regresses.

create unique index if not exists refunds_provider_refund_id_unique
  on public.refunds(provider, provider_refund_id)
  where provider_refund_id is not null;

create index if not exists refunds_order_active_status_idx
  on public.refunds(order_id, status)
  where status not in ('failed', 'cancelled');

create or replace function public.prevent_refund_over_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid_amount numeric;
  v_existing_refunds numeric;
begin
  if new.status in ('failed', 'cancelled') then
    return new;
  end if;

  -- Serialize refund checks per order so concurrent service calls cannot overrun the balance.
  perform pg_advisory_xact_lock(hashtextextended(new.order_id::text, 0));

  select coalesce(p.amount, o.total)
  into v_paid_amount
  from public.orders o
  left join public.payments p on p.id = new.payment_id
  where o.id = new.order_id
  for update of o;

  if v_paid_amount is null then
    raise exception 'REFUND_ORDER_OR_PAYMENT_NOT_FOUND';
  end if;

  select coalesce(sum(r.amount), 0)
  into v_existing_refunds
  from public.refunds r
  where r.order_id = new.order_id
    and r.status not in ('failed', 'cancelled')
    and r.id is distinct from new.id;

  if coalesce(v_existing_refunds, 0) + new.amount > v_paid_amount then
    raise exception 'REFUND_AMOUNT_EXCEEDS_CAPTURED_AMOUNT';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_refund_over_amount on public.refunds;
create trigger trg_prevent_refund_over_amount
before insert or update of order_id, payment_id, amount, status
on public.refunds
for each row
execute function public.prevent_refund_over_amount();

revoke all on function public.prevent_refund_over_amount() from public;
revoke all on function public.prevent_refund_over_amount() from anon;
revoke all on function public.prevent_refund_over_amount() from authenticated;

revoke select (provider_refund_id, raw_payload) on public.refunds from anon, authenticated;
grant select (
  id,
  order_id,
  payment_id,
  cancellation_request_id,
  return_request_id,
  provider,
  amount,
  status,
  reason,
  speed,
  requested_by,
  processed_at,
  created_at,
  updated_at
) on public.refunds to authenticated;

comment on function public.prevent_refund_over_amount() is
  'Prevents active refund rows for an order from exceeding the captured payment/order amount.';
