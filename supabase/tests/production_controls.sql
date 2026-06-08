-- LapKart production controls regression checks.
-- Run with a privileged database role after applying migrations.
-- The file intentionally avoids pgTAP so it can also be pasted into SQL editor.

do $$
declare
  expected_roles text[] := array[
    'admin',
    'user',
    'owner',
    'catalog_manager',
    'order_manager',
    'support',
    'viewer'
  ];
begin
  if exists (
    select role
    from unnest(expected_roles) as role
    except
    select enumlabel
    from pg_enum
    where enumtypid = 'public.app_role'::regtype
  ) then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: app_role enum is missing staff roles';
  end if;
end $$;

do $$
begin
  if to_regclass('public.feature_flags') is null then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: feature_flags table missing';
  end if;

  if to_regclass('public.monitoring_events') is null then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: monitoring_events table missing';
  end if;

  if to_regclass('public.admin_import_jobs') is null then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: admin_import_jobs table missing';
  end if;
end $$;

do $$
declare
  first_result jsonb;
  second_result jsonb;
begin
  if to_regprocedure('public.consume_rate_limit(text, integer, integer)') is null then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: consume_rate_limit function missing';
  end if;

  first_result := public.consume_rate_limit(
    'test:production-controls:' || gen_random_uuid()::text,
    1,
    60
  );

  if coalesce((first_result->>'allowed')::boolean, false) is not true then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: first rate limit request was blocked';
  end if;

  second_result := public.consume_rate_limit('test:production-controls-fixed', 1, 60);
  second_result := public.consume_rate_limit('test:production-controls-fixed', 1, 60);

  if coalesce((second_result->>'allowed')::boolean, true) is not false then
    raise exception 'PRODUCTION_CONTROLS_TEST_FAILED: second fixed rate limit request was not blocked';
  end if;
end $$;
