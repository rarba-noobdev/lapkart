-- Honest social proof sources. Both expose only real, aggregated, non-personal
-- data: weekly purchase counts per product, and recent purchases reduced to
-- product + city area + time (never a customer name, phone, or address line).

-- "Ordered N times this week" — units sold per product over the trailing 7 days,
-- across orders that were not cancelled/refunded. Materialized so the PDP never
-- runs a heavy aggregate on each view; refreshed on a schedule.
create materialized view if not exists public.product_weekly_order_counts as
select
  oi.product_id,
  sum(oi.qty)::int as units,
  count(distinct oi.order_id)::int as orders_count
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.created_at >= now() - interval '7 days'
  and lower(coalesce(o.status, '')) not in ('cancelled', 'refunded', 'returned')
group by oi.product_id;

create unique index if not exists product_weekly_order_counts_product_idx
  on public.product_weekly_order_counts (product_id);

-- Aggregate counts carry no personal data, so the anon/auth roles may read them.
grant select on public.product_weekly_order_counts to anon, authenticated;

-- Refresh helper (concurrently needs the unique index above). Callable by the
-- nightly cron / an admin; safe because it only rebuilds the aggregate.
create or replace function public.refresh_product_weekly_order_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.product_weekly_order_counts;
end;
$$;

revoke all on function public.refresh_product_weekly_order_counts() from public, anon;
grant execute on function public.refresh_product_weekly_order_counts() to authenticated, service_role;

-- Recent purchases ticker. SECURITY DEFINER so it can read orders past RLS, but
-- it deliberately projects ONLY product title + city area + timestamp. No name,
-- phone, email, pincode, or address line ever leaves this function.
create or replace function public.recent_purchases(p_limit int default 12)
returns table (product_id uuid, product_title text, area text, purchased_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, p.title, nullif(btrim(o.shipping_city), ''), o.created_at
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where o.created_at >= now() - interval '2 days'
    and lower(coalesce(o.status, '')) not in ('cancelled', 'refunded', 'returned')
    and nullif(btrim(o.shipping_city), '') is not null
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

revoke all on function public.recent_purchases(int) from public;
grant execute on function public.recent_purchases(int) to anon, authenticated;
