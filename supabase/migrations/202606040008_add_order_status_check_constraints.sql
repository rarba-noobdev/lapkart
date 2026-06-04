-- Add CHECK constraints to order workflow status fields so invalid
-- free-text states cannot enter the database from admin tools or API drift.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending',
    'processing',
    'confirmed',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancellation_requested',
    'cancelled',
    'return_requested',
    'return_approved',
    'return_received',
    'returned',
    'refunded'
  ));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in (
    'pending',
    'paid',
    'cod_pending',
    'cod_cancelled',
    'failed',
    'refunded'
  ));

alter table public.order_cancellation_requests
  drop constraint if exists order_cancellation_requests_status_check;
alter table public.order_cancellation_requests
  add constraint order_cancellation_requests_status_check
  check (status in (
    'pending',
    'refund_pending',
    'refunded',
    'rejected',
    'closed'
  ));

alter table public.return_requests drop constraint if exists return_requests_status_check;
alter table public.return_requests
  add constraint return_requests_status_check
  check (status in (
    'pending',
    'approved',
    'refund_pending',
    'received',
    'refunded',
    'rejected',
    'closed'
  ));

alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds
  add constraint refunds_status_check
  check (status in (
    'pending',
    'created',
    'processed',
    'failed',
    'cancelled'
  ));
