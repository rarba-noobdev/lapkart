-- When an order that spent store credit is cancelled / refunded / returned, the
-- consumed credit is returned to the customer as a fresh 30-day credit. Runs as
-- a trigger so every cancel path (admin RPC, self-service approval, refund) is
-- covered in one place, and is idempotent via a per-order marker row.

create or replace function public.trg_restore_store_credit_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('cancelled', 'refunded', 'returned')
     and old.status is distinct from new.status
     and coalesce(old.store_credit_applied, 0) > 0
     and not exists (
       select 1 from public.store_credits
       where order_id = new.id
         and reason = 'Store credit returned on cancellation'
     )
  then
    insert into public.store_credits (user_id, order_id, amount, balance, reason, expires_at)
    values (
      new.user_id,
      new.id,
      old.store_credit_applied,
      old.store_credit_applied,
      'Store credit returned on cancellation',
      now() + interval '30 days'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists restore_store_credit_on_cancel on public.orders;
create trigger restore_store_credit_on_cancel
  after update of status on public.orders
  for each row execute function public.trg_restore_store_credit_on_cancel();
