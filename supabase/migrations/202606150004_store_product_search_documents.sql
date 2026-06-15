begin;

alter table public.products
  add column if not exists search_document text generated always as (
    public.product_structured_search_text(
      title,
      brand,
      category,
      description,
      sku,
      compatibility,
      warranty,
      highlights,
      search_keywords,
      specifications
    )
  ) stored;

alter table public.products
  add column if not exists normalized_search_document text generated always as (
    public.normalize_part_number_search(
      public.product_structured_search_text(
        title,
        brand,
        category,
        description,
        sku,
        compatibility,
        warranty,
        highlights,
        search_keywords,
        specifications
      )
    )
  ) stored;

drop index if exists public.products_search_idx;
create index products_search_idx
  on public.products using gin (to_tsvector('english', search_document))
  where status = 'active';

drop index if exists public.products_active_part_number_search_trgm_idx;
create index products_active_part_number_search_trgm_idx
  on public.products using gin (normalized_search_document extensions.gin_trgm_ops)
  where status = 'active';

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
      nullif(public.normalize_part_number_search(p_query), '') as part_query,
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
        else ts_rank_cd(to_tsvector('english', p.search_document), search_input.web_query)
      end
      + case
          when search_input.query_text is not null and p.sku ilike search_input.query_text then 6
          when search_input.query_text is not null and p.title ilike search_input.query_text || '%' then 4
          when search_input.query_text is not null and p.title ilike '%' || search_input.query_text || '%' then 2
          when search_input.query_text is not null and p.brand ilike search_input.query_text then 1
          else 0
        end
      + case
          when search_input.part_query is not null
            and public.normalize_part_number_search(coalesce(p.sku, '')) = search_input.part_query then 12
          when search_input.part_query is not null
            and public.normalize_part_number_search(coalesce(p.sku, '')) like search_input.part_query || '%' then 8
          when search_input.part_query is not null
            and p.normalized_search_document = search_input.part_query then 6
          when search_input.part_query is not null
            and p.normalized_search_document like '%' || search_input.part_query || '%' then 4
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
        or to_tsvector('english', p.search_document) @@ search_input.web_query
        or (
          search_input.part_query is not null
          and p.normalized_search_document like '%' || search_input.part_query || '%'
        )
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
  order by
    case when matched.requested_sort = 'price-asc' then matched.price end asc nulls last,
    case when matched.requested_sort = 'price-desc' then matched.price end desc nulls last,
    case when matched.requested_sort = 'rating-desc' then matched.rating end desc nulls last,
    case when matched.requested_sort = 'rating-desc' then matched.reviews end desc nulls last,
    case when matched.requested_sort = 'discount-desc' then (matched.mrp - matched.price) end desc nulls last,
    case when matched.requested_sort = 'newest' then matched.updated_at end desc nulls last,
    case when matched.requested_sort = 'relevance' then matched.search_rank end desc nulls last,
    matched.updated_at desc,
    matched.id asc
  limit (select row_limit from input)
  offset (select row_offset from input);
$$;

comment on column public.products.search_document
is 'Stored product search corpus built from identity, fitment, keywords, highlights, and structured specifications.';

comment on column public.products.normalized_search_document
is 'Stored punctuation-insensitive search corpus for part numbers, FRUs, compatible models, and source identifiers.';

comment on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer)
is 'Indexed product catalog search backed by stored full-text and normalized part-number documents.';

analyze public.products;

commit;
