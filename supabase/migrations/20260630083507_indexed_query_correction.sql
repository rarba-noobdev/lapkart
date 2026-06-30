begin;

-- Pure Postgres search upgrade:
-- - FTS remains the primary indexed candidate path.
-- - pg_trgm powers typo correction against an auxiliary product-term corpus.
-- - Synonyms stay table-driven because managed Supabase projects cannot edit
--   server-side tsearch synonym dictionary files.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.product_search_terms (
  product_id uuid not null references public.products(id) on delete cascade,
  term text not null,
  source_weight smallint not null default 1,
  primary key (product_id, term)
);

alter table public.product_search_terms enable row level security;
revoke all on public.product_search_terms from public, anon, authenticated;

create index if not exists product_search_terms_term_trgm_idx
  on public.product_search_terms using gin (term extensions.gin_trgm_ops);

create index if not exists product_search_terms_product_id_idx
  on public.product_search_terms (product_id);

create index if not exists product_search_terms_term_idx
  on public.product_search_terms (term);

create or replace function public.product_search_terms_from_parts(
  p_title text,
  p_brand text,
  p_category text,
  p_sku text,
  p_compatibility text,
  p_warranty text,
  p_highlights text[],
  p_search_keywords text[],
  p_specifications jsonb
)
returns table(term text, source_weight smallint)
language sql
stable
set search_path = public
as $$
  with spec_text as (
    select coalesce(string_agg(spec.key || ' ' || spec.value, ' '), '') as value
    from jsonb_each_text(coalesce(p_specifications, '{}'::jsonb)) as spec(key, value)
  ),
  raw_terms(source_text, source_weight) as (
    values
      (coalesce(p_title, ''), 6::smallint),
      (coalesce(p_brand, ''), 6::smallint),
      (coalesce(p_sku, ''), 6::smallint),
      (coalesce(p_category, ''), 4::smallint),
      (coalesce(p_compatibility, ''), 4::smallint),
      (coalesce(array_to_string(p_search_keywords, ' '), ''), 4::smallint),
      (coalesce(array_to_string(p_highlights, ' '), ''), 3::smallint),
      (coalesce(p_warranty, ''), 1::smallint)
    union all
    select spec_text.value, 2::smallint
    from spec_text
  ),
  split_terms as (
    select lower(btrim(split.token)) as term, raw_terms.source_weight
    from raw_terms
    cross join lateral regexp_split_to_table(raw_terms.source_text, '[^[:alnum:]]+') as split(token)
  )
  select split_terms.term, max(split_terms.source_weight)::smallint
  from split_terms
  where length(split_terms.term) between 3 and 80
    and split_terms.term !~ '^[0-9]+$'
  group by split_terms.term;
$$;

revoke all on function public.product_search_terms_from_parts(
  text, text, text, text, text, text, text[], text[], jsonb
) from public, anon, authenticated;

create or replace function public.refresh_product_search_terms(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_search_terms
  where product_id = p_product_id;

  insert into public.product_search_terms(product_id, term, source_weight)
  select p.id, terms.term, max(terms.source_weight)::smallint
  from public.products p
  cross join lateral public.product_search_terms_from_parts(
    p.title,
    p.brand,
    p.category,
    p.sku,
    p.compatibility,
    p.warranty,
    p.highlights,
    p.search_keywords,
    p.specifications
  ) as terms
  where p.id = p_product_id
    and p.status = 'active'
  group by p.id, terms.term
  on conflict (product_id, term) do update
    set source_weight = excluded.source_weight;
end;
$$;

revoke all on function public.refresh_product_search_terms(uuid) from public, anon, authenticated;

create or replace function public.sync_product_search_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.product_search_terms
    where product_id = old.id;
    return old;
  end if;

  perform public.refresh_product_search_terms(new.id);
  return new;
end;
$$;

revoke all on function public.sync_product_search_terms() from public, anon, authenticated;

drop trigger if exists products_search_terms_upsert_sync on public.products;
create trigger products_search_terms_upsert_sync
after insert or update of title, brand, category, sku, compatibility, warranty, highlights, search_keywords, specifications, status
on public.products
for each row execute function public.sync_product_search_terms();

drop trigger if exists products_search_terms_delete_sync on public.products;
create trigger products_search_terms_delete_sync
after delete on public.products
for each row execute function public.sync_product_search_terms();

insert into public.product_search_terms(product_id, term, source_weight)
select p.id, terms.term, max(terms.source_weight)::smallint
from public.products p
cross join lateral public.product_search_terms_from_parts(
  p.title,
  p.brand,
  p.category,
  p.sku,
  p.compatibility,
  p.warranty,
  p.highlights,
  p.search_keywords,
  p.specifications
) as terms
where p.status = 'active'
group by p.id, terms.term
on conflict (product_id, term) do update
  set source_weight = greatest(public.product_search_terms.source_weight, excluded.source_weight);

-- Add more laptop-part synonym coverage and keep the dictionary editable from SQL.
insert into public.search_synonyms (term, synonyms) values
  ('solid state drive', array['ssd', 'nvme', 'm2 drive', 'm.2 drive']),
  ('nvme', array['ssd', 'solid state drive', 'm2 drive', 'm.2 drive']),
  ('m2', array['m.2', 'nvme', 'ssd']),
  ('m.2', array['m2', 'nvme', 'ssd']),
  ('hard drive', array['hdd', 'hard disk']),
  ('hard disk', array['hdd', 'hard drive']),
  ('memory', array['ram', 'ddr', 'ddr3', 'ddr4', 'ddr5', 'sodimm']),
  ('sodimm', array['ram', 'memory', 'ddr']),
  ('power adapter', array['charger', 'adapter', 'ac adapter', 'power supply']),
  ('ac adapter', array['charger', 'adapter', 'power adapter']),
  ('lcd', array['screen', 'display', 'panel']),
  ('panel', array['screen', 'display', 'lcd']),
  ('keypad', array['keyboard', 'kbd']),
  ('trackpad', array['touchpad', 'track pad']),
  ('wireless card', array['wifi card', 'wlan card', 'wifi module']),
  ('wlan', array['wifi', 'wireless card', 'wifi module']),
  ('power jack', array['dc jack', 'dc port', 'charging port']),
  ('charging port', array['dc jack', 'power jack', 'dc port']),
  ('top case', array['palmrest', 'palm rest']),
  ('front frame', array['bezel', 'screen bezel', 'lcd bezel']),
  ('cmos', array['rtc battery', 'coin cell']),
  ('rtc battery', array['cmos', 'coin cell'])
on conflict (term) do update
  set synonyms = (
    select array_agg(distinct value order by value)
    from unnest(public.search_synonyms.synonyms || excluded.synonyms) as merged(value)
  );

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
  normalized_base text := ' ' || regexp_replace(lower(coalesce(p_query, '')), '[^a-z0-9]+', ' ', 'g') || ' ';
  compact_base text := regexp_replace(lower(coalesce(p_query, '')), '[^a-z0-9]+', '', 'g');
begin
  normalized_base := regexp_replace(normalized_base, '\s+', ' ', 'g');

  if btrim(normalized_base) = '' then
    return null;
  end if;

  for syn in
    with normalized_terms as (
      select
        s.term,
        unnest(s.synonyms) as synonym,
        btrim(regexp_replace(lower(s.term), '[^a-z0-9]+', ' ', 'g')) as normalized_term,
        regexp_replace(lower(s.term), '[^a-z0-9]+', '', 'g') as compact_term
      from public.search_synonyms s
    )
    select distinct normalized_terms.synonym
    from normalized_terms
    where position(' ' || normalized_terms.normalized_term || ' ' in normalized_base) > 0
       or (
         length(normalized_terms.compact_term) >= 2
         and normalized_terms.compact_term ~ '[0-9]'
         and position(normalized_terms.compact_term in compact_base) > 0
       )
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

create or replace function public.correct_product_search_query(p_query text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  with tokens as (
    select row_number() over () as position, lower(btrim(split.token)) as token
    from regexp_split_to_table(coalesce(p_query, ''), '[^[:alnum:]]+') as split(token)
    where length(btrim(split.token)) between 3 and 80
  ),
  corrected as (
    select
      tokens.position,
      coalesce(best.term, tokens.token) as token
    from tokens
    left join lateral (
      select terms.term
      from public.product_search_terms terms
      where terms.term % tokens.token
        and abs(length(terms.term) - length(tokens.token)) <= greatest(2, ceil(length(tokens.token) * 0.4)::int)
      group by terms.term, tokens.token
      order by
        case when terms.term = tokens.token then 1 else 0 end desc,
        similarity(terms.term, tokens.token) desc,
        max(terms.source_weight) desc,
        count(*) desc,
        terms.term asc
      limit 1
    ) best on true
  )
  select nullif(string_agg(corrected.token, ' ' order by corrected.position), '')
  from corrected;
$$;

revoke all on function public.correct_product_search_query(text) from public, anon, authenticated;

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
      base_query.normalized_query_text,
      base_query.corrected_query_text,
      base_query.web_query,
      base_query.corrected_query,
      case
        when base_query.web_query is null then base_query.syn_query || base_query.corrected_query
        when base_query.syn_query is null and base_query.corrected_query is null then base_query.web_query
        when base_query.syn_query is null then base_query.web_query || base_query.corrected_query
        when base_query.corrected_query is null then base_query.web_query || base_query.syn_query
        else base_query.web_query || base_query.syn_query || base_query.corrected_query
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
        nullif(btrim(regexp_replace(lower(coalesce(input.query_text, '')), '[^a-z0-9]+', ' ', 'g')), '') as normalized_query_text,
        public.correct_product_search_query(input.query_text) as raw_corrected_query_text
    ) correction_input
    cross join lateral (
      select
        correction_input.normalized_query_text,
        case
          when correction_input.raw_corrected_query_text is not null
            and correction_input.raw_corrected_query_text <> correction_input.normalized_query_text
          then correction_input.raw_corrected_query_text
          else null
        end as corrected_query_text,
        case when input.query_text is null then null
             else websearch_to_tsquery('english', input.query_text) end as web_query,
        case when input.query_text is null then null
             else public.expand_query_synonyms(input.query_text) end as syn_query,
        case
          when correction_input.raw_corrected_query_text is not null
            and correction_input.raw_corrected_query_text <> correction_input.normalized_query_text
          then websearch_to_tsquery('english', correction_input.raw_corrected_query_text)
          else null
        end as corrected_query
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
        else ts_rank_cd(
          '{0.05,0.2,0.7,1.5}'::float4[],
          weighted.search_vector,
          search_input.combined_query,
          32
        ) * 8
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
      + case
          when search_input.corrected_query_text is not null then 1.5
          else 0
        end
      + case
          when search_input.query_text is not null and not search_input.strict_display_phrase
          then greatest(
            similarity(search_input.query_text, p.title || ' ' || coalesce(p.brand, '')),
            word_similarity(search_input.query_text, p.title || ' ' || coalesce(p.brand, ''))
          ) * 2
          else 0
        end as search_rank,
      count(*) over () as total_count
    from candidate_ids candidates
    join public.products p on p.id = candidates.id
    cross join search_input
    cross join lateral (
      select
        setweight(to_tsvector('english', coalesce(p.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(p.brand, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(p.sku, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(p.category, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(p.compatibility, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(p.search_keywords, ' '), '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(p.highlights, ' '), '')), 'C') ||
        setweight(to_tsvector('english', coalesce(spec_text.value, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(p.warranty, '')), 'D') as search_vector
      from (
        select coalesce(string_agg(spec.key || ' ' || spec.value, ' '), '') as value
        from jsonb_each_text(coalesce(p.specifications, '{}'::jsonb)) as spec(key, value)
      ) spec_text
    ) weighted
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

comment on table public.product_search_terms
is 'Internal active-product term corpus used by pg_trgm to correct misspelled search queries before full-text ranking.';

comment on function public.correct_product_search_query(text)
is 'Corrects misspelled search tokens against the active product term corpus using pg_trgm similarity.';

comment on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer)
is 'Public active-product search. Uses indexed FTS, table-driven synonyms, corpus-backed trigram typo correction, weighted ranking, exact part-number matching, strict display guards, and stock-first ordering.';

analyze public.product_search_terms;
notify pgrst, 'reload schema';

commit;
