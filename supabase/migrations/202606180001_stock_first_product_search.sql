begin;

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
security definer
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
      end as web_query,
      case
        when input.category = 'displays'
          and input.query_text ~* '(^|[^a-z0-9])(aio|all[- ]?in[- ]?one|allinone|tablet|ipad|iphone|smartphone|android phone|mobile phone|galaxy[ -]?tab|mi[ -]?pad|redmi[ -]?pad|xiaomi[ -]?pad|surface[ -]?(pro|go)|venue|poco|redmi|xiaomi|ideacentre|thinkcentre|chromebase|expertcenter|expertcentre|desktop|monitor|veriton[ -]?z|vivo[ -]?aio|zen[ -]?aio|inspiron[ -]?one)([^a-z0-9]|$)'
        then true
        else false
      end as strict_display_phrase
    from input
  ),
  candidate_ids as (
    select p.id
    from public.products p
    cross join search_input
    where search_input.query_text is null
      and p.status = 'active'
      and (search_input.category is null or p.category = search_input.category)
      and (search_input.brand is null or p.brand = search_input.brand)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_in_stock is distinct from true or p.stock > 0)

    union

    select p.id
    from public.products p
    cross join search_input
    where search_input.web_query is not null
      and search_input.strict_display_phrase is not true
      and p.status = 'active'
      and (search_input.category is null or p.category = search_input.category)
      and (search_input.brand is null or p.brand = search_input.brand)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_in_stock is distinct from true or p.stock > 0)
      and to_tsvector('english', p.search_document) @@ search_input.web_query

    union

    select p.id
    from public.products p
    cross join search_input
    where search_input.part_query is not null
      and search_input.strict_display_phrase is not true
      and p.status = 'active'
      and (search_input.category is null or p.category = search_input.category)
      and (search_input.brand is null or p.brand = search_input.brand)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_in_stock is distinct from true or p.stock > 0)
      and p.normalized_search_document like '%' || search_input.part_query || '%'
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
        when search_input.web_query is null or search_input.strict_display_phrase then 0
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
    from candidate_ids candidates
    join public.products p on p.id = candidates.id
    cross join search_input
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
    case when matched.stock > 0 then 0 else 1 end asc,
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

grant execute on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer) to anon, authenticated;

comment on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer)
is 'Public active-product search. SECURITY DEFINER is intentionally used to avoid RLS planning overhead; strict non-laptop display phrases bypass loose token and substring matching. In-stock products sort ahead of out-of-stock products.';

notify pgrst, 'reload schema';

commit;
