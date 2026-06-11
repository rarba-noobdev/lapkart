begin;

create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema extensions;
alter extension "pg_trgm" set schema extensions;

drop trigger if exists trg_enqueue_product_search_sync on public.products;
drop trigger if exists trg_touch_product_search_sync_event on public.product_search_sync_events;
drop function if exists public.enqueue_product_search_sync();
drop function if exists public.touch_product_search_sync_event();
drop table if exists public.product_search_sync_events;

drop index if exists public.products_search_idx;

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
    coalesce(p_description, '') || ' ' ||
    coalesce(p_sku, '') || ' ' ||
    coalesce(p_compatibility, '') || ' ' ||
    coalesce(p_warranty, '') || ' ' ||
    coalesce(array_to_string(p_highlights, ' '), '') || ' ' ||
    coalesce(array_to_string(p_search_keywords, ' '), '');
$$;

create index if not exists products_search_idx
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

create index if not exists products_active_category_brand_idx
  on public.products (category, brand)
  where status = 'active';

create index if not exists products_active_price_idx
  on public.products (price)
  where status = 'active';

create index if not exists products_active_rating_idx
  on public.products (rating desc, reviews desc)
  where status = 'active';

create index if not exists products_active_updated_idx
  on public.products (updated_at desc, id)
  where status = 'active';

create index if not exists products_active_title_trgm_idx
  on public.products using gin (title extensions.gin_trgm_ops)
  where status = 'active';

create index if not exists products_active_brand_trgm_idx
  on public.products using gin (brand extensions.gin_trgm_ops)
  where status = 'active';

create index if not exists products_active_sku_trgm_idx
  on public.products using gin (sku extensions.gin_trgm_ops)
  where status = 'active' and sku is not null;

create or replace function public.search_active_products(
  p_query text default null,
  p_category text default null,
  p_brand text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_in_stock boolean default null,
  p_min_rating numeric default null,
  p_sort text default 'relevance',
  p_limit integer default 96,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  brand text,
  category text,
  image text,
  images text[],
  source_url text,
  price numeric,
  mrp numeric,
  rating numeric,
  reviews integer,
  stock integer,
  compatibility text,
  warranty text,
  highlights text[],
  authenticity_grade text,
  condition_grade text,
  local_delivery_eligible boolean,
  cod_eligible boolean,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with input as (
    select
      nullif(btrim(p_query), '') as query_text,
      nullif(btrim(p_category), '') as category,
      nullif(btrim(p_brand), '') as brand,
      greatest(1, least(coalesce(p_limit, 96), 250)) as row_limit,
      greatest(0, coalesce(p_offset, 0)) as row_offset,
      coalesce(nullif(p_sort, ''), 'relevance') as requested_sort
  ),
  search_input as (
    select
      input.*,
      case
        when input.query_text is null then null
        else websearch_to_tsquery('english', input.query_text)
      end as web_query
    from input
  ),
  matched as (
    select
      p.id,
      p.title,
      p.brand,
      p.category,
      p.image,
      p.images,
      p.source_url,
      p.price,
      p.mrp,
      p.rating,
      p.reviews,
      p.stock,
      p.compatibility,
      p.warranty,
      p.highlights,
      p.authenticity_grade,
      p.condition_grade,
      p.local_delivery_eligible,
      p.cod_eligible,
      p.updated_at,
      search_input.requested_sort,
      case
        when search_input.web_query is null then 0
        else ts_rank_cd(
          to_tsvector(
            'english',
            public.product_search_text(
              p.title,
              p.brand,
              p.category,
              p.description,
              p.sku,
              p.compatibility,
              p.warranty,
              p.highlights,
              p.search_keywords
            )
          ),
          search_input.web_query
        )
      end
      + case
          when search_input.query_text is not null and p.sku ilike search_input.query_text then 2
          when search_input.query_text is not null and p.title ilike search_input.query_text || '%' then 1
          else 0
        end as search_rank,
      count(*) over () as total_count
    from public.products p
    cross join search_input
    where p.status = 'active'
      and (search_input.category is null or p.category = search_input.category)
      and (search_input.brand is null or p.brand = search_input.brand)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_in_stock is distinct from true or p.stock > 0)
      and (
        search_input.query_text is null
        or to_tsvector(
          'english',
          public.product_search_text(
            p.title,
            p.brand,
            p.category,
            p.description,
            p.sku,
            p.compatibility,
            p.warranty,
            p.highlights,
            p.search_keywords
          )
        ) @@ search_input.web_query
        or p.title ilike '%' || search_input.query_text || '%'
        or p.brand ilike '%' || search_input.query_text || '%'
        or p.category ilike '%' || search_input.query_text || '%'
        or p.sku ilike '%' || search_input.query_text || '%'
      )
  )
  select
    matched.id,
    matched.title,
    matched.brand,
    matched.category,
    matched.image,
    matched.images,
    matched.source_url,
    matched.price,
    matched.mrp,
    matched.rating,
    matched.reviews,
    matched.stock,
    matched.compatibility,
    matched.warranty,
    matched.highlights,
    matched.authenticity_grade,
    matched.condition_grade,
    matched.local_delivery_eligible,
    matched.cod_eligible,
    matched.updated_at,
    matched.total_count
  from matched
  cross join search_input
  order by
    case when matched.requested_sort = 'price-asc' then matched.price end asc nulls last,
    case when matched.requested_sort = 'price-desc' then matched.price end desc nulls last,
    case when matched.requested_sort = 'rating-desc' then matched.rating end desc nulls last,
    case when matched.requested_sort = 'rating-desc' then matched.reviews end desc nulls last,
    case when matched.requested_sort = 'discount-desc' then greatest(matched.mrp - matched.price, 0) / nullif(matched.mrp, 0) end desc nulls last,
    case when matched.requested_sort = 'newest' then matched.updated_at end desc nulls last,
    case when matched.requested_sort = 'relevance' then matched.search_rank end desc nulls last,
    matched.updated_at desc,
    matched.id asc
  limit (select row_limit from search_input)
  offset (select row_offset from search_input);
$$;

grant execute on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer) to anon, authenticated;

comment on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer)
  is 'Indexed product catalog search using Postgres full-text and trigram indexes. Replaces the external Typesense runtime dependency.';

commit;
