begin;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
revoke all on function public.is_admin() from authenticated;

create index if not exists checkout_sessions_order_id_idx on public.checkout_sessions(order_id);
create index if not exists coupon_redemptions_order_id_idx on public.coupon_redemptions(order_id);
create index if not exists order_cancellation_requests_refund_id_idx on public.order_cancellation_requests(refund_id);
create index if not exists product_reviews_order_id_idx on public.product_reviews(order_id);
create index if not exists refunds_cancellation_request_id_idx on public.refunds(cancellation_request_id);
create index if not exists refunds_return_request_id_idx on public.refunds(return_request_id);
create index if not exists refunds_requested_by_idx on public.refunds(requested_by);
create index if not exists return_requests_refund_id_idx on public.return_requests(refund_id);
create index if not exists return_requests_reverse_shipment_id_idx on public.return_requests(reverse_shipment_id);

commit;
