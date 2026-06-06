-- LapKart security hardening regression checks.
-- Run with a privileged database role after applying migrations.
-- The file intentionally avoids pgTAP so it can also be pasted into SQL editor.

do $$
begin
  if exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and not rowsecurity
  ) then
    raise exception 'SECURITY_TEST_FAILED: public table without RLS';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in (
        'orders',
        'order_items',
        'payments',
        'checkout_sessions',
        'shipments',
        'shipment_packages',
        'shipment_events',
        'refunds',
        'admin_order_events',
        'admin_user_events',
        'user_roles'
      )
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception 'SECURITY_TEST_FAILED: browser role has direct DML on server-owned table';
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.admin_cancel_order(uuid, uuid, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'SECURITY_TEST_FAILED: anon can execute admin_cancel_order';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.admin_cancel_order(uuid, uuid, text, jsonb)',
    'EXECUTE'
  ) then
    raise exception 'SECURITY_TEST_FAILED: authenticated can execute admin_cancel_order';
  end if;

  if has_function_privilege(
    'anon',
    'public.prevent_order_snapshot_mutation()',
    'EXECUTE'
  ) then
    raise exception 'SECURITY_TEST_FAILED: anon can execute order trigger helper';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'payments'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
      and column_name in ('provider_signature', 'raw_payload')
  ) then
    raise exception 'SECURITY_TEST_FAILED: authenticated can select sensitive payment columns';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'trg_prevent_order_snapshot_mutation'
      and not tgisinternal
  ) then
    raise exception 'SECURITY_TEST_FAILED: orders immutable trigger missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.payments'::regclass
      and tgname = 'trg_prevent_payment_snapshot_mutation'
      and not tgisinternal
  ) then
    raise exception 'SECURITY_TEST_FAILED: payments immutable trigger missing';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products public read active'
      and qual like '%status = ''active''%'
      and qual not ilike '%is_admin%'
      and qual not ilike '%has_role%'
  ) then
    raise exception 'SECURITY_TEST_FAILED: active-only product policy missing or calls admin helper';
  end if;
end $$;

do $$
declare
  sample_order_id uuid;
begin
  select id into sample_order_id
  from public.orders
  limit 1;

  if sample_order_id is not null then
    begin
      update public.orders
      set total = total + 1
      where id = sample_order_id;

      raise exception 'SECURITY_TEST_FAILED: immutable order total update succeeded';
    exception
      when raise_exception then
        if sqlerrm <> 'ORDER_TOTAL_IMMUTABLE' then
          raise;
        end if;
    end;
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.prevent_refund_over_amount()',
    'EXECUTE'
  ) then
    raise exception 'SECURITY_TEST_FAILED: authenticated can execute refund trigger helper';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.refunds'::regclass
      and tgname = 'trg_prevent_refund_over_amount'
      and not tgisinternal
  ) then
    raise exception 'SECURITY_TEST_FAILED: refund over-amount trigger missing';
  end if;

  if exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'refunds'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
      and column_name in ('provider_refund_id', 'raw_payload')
  ) then
    raise exception 'SECURITY_TEST_FAILED: authenticated can select sensitive refund columns';
  end if;
end $$;

do $$
declare
  sample_order record;
begin
  select id, total into sample_order
  from public.orders
  limit 1;

  if sample_order.id is not null then
    begin
      insert into public.refunds (
        order_id,
        amount,
        status,
        reason
      )
      values (
        sample_order.id,
        sample_order.total + 1,
        'pending',
        'security regression over-refund attempt'
      );

      raise exception 'SECURITY_TEST_FAILED: over-refund insert succeeded';
    exception
      when raise_exception then
        if sqlerrm <> 'REFUND_AMOUNT_EXCEEDS_CAPTURED_AMOUNT' then
          raise;
        end if;
    end;
  end if;
end $$;
