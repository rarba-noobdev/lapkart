begin;

-- ---------------------------------------------------------------------------
-- $0 search quality upgrade: typo tolerance (pg_trgm) + synonym expansion.
--
-- Supabase managed Postgres has no filesystem access for the classic file-based
-- synonym dictionary (`CREATE TEXT SEARCH DICTIONARY ... (template = synonym)`),
-- so synonyms are stored in a table and OR-ed into the tsquery at search time.
-- Typo tolerance uses pg_trgm word-similarity, which needs no external service.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

-- Trigram indexes for fast fuzzy matching. The fuzzy branch matches on a short
-- title+brand expression (word_similarity over the full search_document blob is
-- too slow), so the expression index below is what the <% operator uses.
create index if not exists products_search_document_trgm
  on public.products using gin (search_document extensions.gin_trgm_ops);

create index if not exists products_title_brand_trgm
  on public.products using gin ((title || ' ' || coalesce(brand, '')) extensions.gin_trgm_ops);

-- NOTE: the <% operator uses pg_trgm.word_similarity_threshold (default 0.6).
-- Supabase blocks setting that GUC (function config, ALTER ROLE, and SET all
-- return 42501 for non-superusers), so the typo bar stays at 0.6. That catches
-- most single-character typos (chargr, batery, keybord); very heavy typos
-- (transpositions like "keyborad", or "lenvo") fall just under and are missed.
-- Lowering it needs Supabase to grant the param, or a dedicated search engine.

-- ── Synonym table ──────────────────────────────────────────────────────────
create table if not exists public.search_synonyms (
  term text primary key,
  synonyms text[] not null default '{}'
);

alter table public.search_synonyms enable row level security;

-- Readable by anyone (search runs as anon); writes stay service-role only.
drop policy if exists search_synonyms_read on public.search_synonyms;
create policy search_synonyms_read on public.search_synonyms
  for select using (true);

-- Seed common laptop-parts synonyms. term is matched as a whole word in the
-- query; its synonyms are OR-ed into the full-text query.
insert into public.search_synonyms (term, synonyms) values
  ('ssd', array['solid state drive', 'nvme', 'm2 drive']),
  ('hdd', array['hard disk', 'hard drive']),
  ('ram', array['memory', 'ddr', 'ddr3', 'ddr4', 'ddr5', 'sodimm']),
  ('charger', array['adapter', 'ac adapter', 'power adapter', 'power supply']),
  ('adapter', array['charger', 'power adapter']),
  ('screen', array['display', 'panel', 'lcd', 'led screen']),
  ('display', array['screen', 'panel', 'lcd']),
  ('keyboard', array['keypad', 'kbd']),
  ('battery', array['cell', 'power cell']),
  ('fan', array['cooler', 'cooling fan', 'heatsink fan']),
  ('cooling', array['fan', 'cooler', 'heatsink']),
  ('hinge', array['hinges', 'hinge set']),
  ('motherboard', array['mainboard', 'logic board', 'system board']),
  ('webcam', array['camera', 'web camera']),
  ('touchpad', array['trackpad', 'track pad']),
  ('wifi card', array['wireless card', 'wlan card', 'wifi module']),
  ('dc jack', array['power jack', 'dc port', 'charging port']),
  ('palmrest', array['palm rest', 'top case']),
  ('bezel', array['screen bezel', 'lcd bezel', 'front frame'])
on conflict (term) do update set synonyms = excluded.synonyms;

-- ── Synonym expansion helper ───────────────────────────────────────────────
-- Returns an OR-ed tsquery of synonyms for any synonym terms present in the
-- query text, or null when nothing matches.
create or replace function public.expand_query_synonyms(p_query text)
returns tsquery
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result tsquery := null;
  syn text;
  base text := lower(coalesce(p_query, ''));
begin
  if btrim(base) = '' then
    return null;
  end if;

  for syn in
    select distinct unnest(s.synonyms)
    from public.search_synonyms s
    where base ~ ('(^|[^a-z0-9])' || s.term || '([^a-z0-9]|$)')
  loop
    if syn is null or btrim(syn) = '' then
      continue;
    end if;
    result := case
      when result is null then phraseto_tsquery('english', syn)
      else result || phraseto_tsquery('english', syn)
    end;
  end loop;

  return result;
end;
$$;

grant execute on function public.expand_query_synonyms(text) to anon, authenticated;

-- ── Search function ────────────────────────────────────────────────────────
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
set search_path = public, extensions
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
      base_query.web_query,
      case
        when base_query.web_query is null then base_query.syn_query
        when base_query.syn_query is null then base_query.web_query
        else base_query.web_query || base_query.syn_query
      end as combined_query,
      case
        when input.category = 'displays'
          and input.query_text ~* '(^|[^a-z0-9])(aio|all[- ]?in[- ]?one|allinone|tablet|ipad|iphone|smartphone|android phone|mobile phone|galaxy[ -]?tab|mi[ -]?pad|redmi[ -]?pad|xiaomi[ -]?pad|surface[ -]?(pro|go)|venue|poco|redmi|xiaomi|ideacentre|thinkcentre|chromebase|expertcenter|expertcentre|desktop|monitor|veriton[ -]?z|vivo[ -]?aio|zen[ -]?aio|inspiron[ -]?one)([^a-z0-9]|$)'
        then true
        else false
      end as strict_display_phrase
    from input
    cross join lateral (
      select
        case when input.query_text is null then null
             else websearch_to_tsquery('english', input.query_text) end as web_query,
        case when input.query_text is null then null
             else public.expand_query_synonyms(input.query_text) end as syn_query
    ) base_query
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

    -- Full-text (with synonym expansion)
    select p.id
    from public.products p
    cross join search_input
    where search_input.combined_query is not null
      and search_input.strict_display_phrase is not true
      and p.status = 'active'
      and (search_input.category is null or p.category = search_input.category)
      and (search_input.brand is null or p.brand = search_input.brand)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_in_stock is distinct from true or p.stock > 0)
      and to_tsvector('english', p.search_document) @@ search_input.combined_query

    union

    -- Part-number substring
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

    union

    -- Fuzzy / typo tolerance (pg_trgm word similarity)
    select p.id
    from public.products p
    cross join search_input
    where search_input.query_text is not null
      and length(search_input.query_text) >= 3
      and search_input.strict_display_phrase is not true
      and p.status = 'active'
      and (search_input.category is null or p.category = search_input.category)
      and (search_input.brand is null or p.brand = search_input.brand)
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_rating is null or p.rating >= p_min_rating)
      and (p_in_stock is distinct from true or p.stock > 0)
      -- Typo tolerance: index-assisted word similarity on title+brand via the
      -- <% operator (uses products_title_brand_trgm; threshold from role GUC).
      and search_input.query_text <% (p.title || ' ' || coalesce(p.brand, ''))
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
        when search_input.combined_query is null or search_input.strict_display_phrase then 0
        else ts_rank_cd(to_tsvector('english', p.search_document), search_input.combined_query)
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
        end
      -- Fuzzy similarity contributes a small boost so exact/FTS hits still win.
      + case
          when search_input.query_text is not null and not search_input.strict_display_phrase
          then word_similarity(search_input.query_text, p.title || ' ' || coalesce(p.brand, '')) * 2
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
is 'Public active-product search. Adds pg_trgm typo tolerance and table-driven synonym expansion on top of full-text + part-number matching. SECURITY DEFINER avoids RLS planning overhead; strict non-laptop display phrases bypass loose matching; in-stock products sort first.';

notify pgrst, 'reload schema';

commit;
