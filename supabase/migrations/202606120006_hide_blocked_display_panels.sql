update public.products
set
  highlights = array(
    select case
      when highlight = 'Manual Tamil Nadu delivery' then 'Tamil Nadu courier delivery'
      else highlight
    end
    from unnest(coalesce(highlights, array[]::text[])) as highlight
  ),
  updated_at = now()
where category = 'displays'
  and 'Manual Tamil Nadu delivery' = any(coalesce(highlights, array[]::text[]));

update public.products
set
  status = 'archived',
  stock = 0,
  updated_at = now()
where category = 'displays'
  and (
    title ilike '%sharp%'
    or brand ilike '%sharp%'
    or coalesce(sku, '') ilike '%sharp%'
    or coalesce(compatibility, '') ilike '%sharp%'
    or specifications::text ilike '%sharp%'
    or title ilike '%tianma%'
    or brand ilike '%tianma%'
    or coalesce(sku, '') ilike '%tianma%'
    or coalesce(compatibility, '') ilike '%tianma%'
    or specifications::text ilike '%tianma%'
  );
