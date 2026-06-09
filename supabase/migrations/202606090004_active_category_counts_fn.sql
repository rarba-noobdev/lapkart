-- Storefront category facet counts. The previous loader fetched every active
-- product's category and grouped client-side, which silently capped at the
-- PostgREST 1000-row limit and undercounted once the catalog grew past 1000.
-- This function returns the full per-category counts in one round trip.
create or replace function public.active_category_counts()
returns table(category text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select category, count(*)::bigint
  from public.products
  where status = 'active'
  group by category
$$;

grant execute on function public.active_category_counts() to anon, authenticated;
