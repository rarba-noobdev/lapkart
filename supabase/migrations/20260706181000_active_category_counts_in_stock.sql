-- Storefront category counts should match the public catalog visibility rule:
-- active products with available stock only.
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
    and stock > 0
  group by category
$$;

grant execute on function public.active_category_counts() to anon, authenticated;
