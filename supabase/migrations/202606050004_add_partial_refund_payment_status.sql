alter table public.orders drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (
    payment_status in (
      'pending',
      'paid',
      'cod_pending',
      'cod_cancelled',
      'failed',
      'partially_refunded',
      'refunded'
    )
  );
