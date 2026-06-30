begin;

do $$
declare
  function_sql text;
begin
  select pg_get_functiondef(
    'public.search_active_products(text,text,text,numeric,numeric,boolean,numeric,text,integer,integer)'::regprocedure
  )
  into function_sql;

  if function_sql is null then
    raise exception 'search_active_products function was not found';
  end if;

  if position('cross join lateral (
      select
        setweight(to_tsvector(' in function_sql) = 0 then
    if position('left join lateral (
      select
        setweight(to_tsvector(' in function_sql) > 0 then
      return;
    end if;

    raise exception 'search_active_products weighted join had an unexpected shape';
  end if;

  function_sql := replace(
    function_sql,
    'cross join lateral (
      select
        setweight(to_tsvector(',
    'left join lateral (
      select
        setweight(to_tsvector('
  );

  function_sql := replace(
    function_sql,
    '      ) spec_text
    ) weighted
  )
  select',
    '      ) spec_text
    ) weighted on search_input.combined_query is not null and search_input.strict_display_phrase is not true
  )
  select'
  );

  execute function_sql;
end $$;

grant execute on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer) to anon, authenticated;

comment on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer)
is 'Public active-product search. Uses indexed FTS, table-driven synonyms, corpus-backed trigram typo correction, weighted ranking, exact part-number matching, strict display guards, stock-first ordering, and a fast unfiltered catalog path.';

notify pgrst, 'reload schema';

commit;
