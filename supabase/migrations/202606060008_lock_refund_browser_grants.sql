-- Refund creation/update is service-owned. Browser clients may only read safe summary columns through RLS.

revoke all on table public.refunds from anon;
revoke all on table public.refunds from authenticated;

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

comment on table public.refunds is
  'Refund rows are backend/service-owned. Browser clients can read safe own-order summaries only; provider IDs and raw payloads stay hidden.';
