begin;

-- The indexed query-correction migration briefly created search_active_products
-- with an out-of-range ts_rank_cd weight. Keep the function body intact and
-- only normalize the highest weight to Postgres' accepted range.
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

  if position('''{0.05,0.2,0.7,1.5}''::float4[]' in function_sql) > 0 then
    function_sql := replace(
      function_sql,
      '''{0.05,0.2,0.7,1.5}''::float4[]',
      '''{0.05,0.2,0.7,1.0}''::float4[]'
    );
  elsif position('''{0.05,0.2,0.7,1.0}''::float4[]' in function_sql) = 0 then
    raise exception 'search_active_products ranking weights had an unexpected shape';
  end if;

  execute function_sql;
end $$;

grant execute on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer) to anon, authenticated;

comment on function public.search_active_products(text, text, text, numeric, numeric, boolean, numeric, text, integer, integer)
is 'Public active-product search. Uses indexed FTS, table-driven synonyms, corpus-backed trigram typo correction, weighted ranking, exact part-number matching, strict display guards, and stock-first ordering.';

notify pgrst, 'reload schema';

commit;
