begin;

create or replace function public.product_search_text(
  p_title text,
  p_brand text,
  p_category text,
  p_description text,
  p_sku text,
  p_compatibility text,
  p_warranty text,
  p_highlights text[],
  p_search_keywords text[]
)
returns text
language sql
immutable
set search_path = public
as $$
  select
    coalesce(p_title, '') || ' ' ||
    coalesce(p_brand, '') || ' ' ||
    coalesce(p_category, '') || ' ' ||
    coalesce(p_sku, '') || ' ' ||
    coalesce(p_compatibility, '') || ' ' ||
    coalesce(p_warranty, '') || ' ' ||
    coalesce(array_to_string(p_highlights, ' '), '') || ' ' ||
    coalesce(array_to_string(p_search_keywords, ' '), '');
$$;

drop index if exists public.products_search_idx;
create index products_search_idx
  on public.products using gin (
    to_tsvector(
      'english',
      public.product_search_text(
        title,
        brand,
        category,
        description,
        sku,
        compatibility,
        warranty,
        highlights,
        search_keywords
      )
    )
  )
  where status = 'active';

drop index if exists public.products_active_part_number_search_trgm_idx;
create index products_active_part_number_search_trgm_idx
on public.products using gin (
  public.normalize_part_number_search(
    public.product_search_text(
      title,
      brand,
      category,
      description,
      sku,
      compatibility,
      warranty,
      highlights,
      search_keywords
    )
  ) extensions.gin_trgm_ops
)
where status = 'active';

comment on function public.product_search_text(text, text, text, text, text, text, text, text[], text[])
is 'Builds the product search corpus from structured catalog fields. Description prose is intentionally excluded to avoid noisy matches.';

commit;
