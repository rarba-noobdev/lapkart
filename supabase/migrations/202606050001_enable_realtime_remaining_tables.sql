-- Enable realtime for all remaining tables the app subscribes to
do $$
declare
  table_name text;
  tables_to_publish text[] := array[
    'coupon_redemptions',
    'coupons',
    'order_cancellation_requests',
    'order_invoices',
    'refunds',
    'return_requests',
    'stock_notification_events',
    'business_accounts',
    'product_questions',
    'user_roles',
    'profiles',
    'inventory_logs',
    'stock_notifications',
    'wishlist_items',
    'product_reviews',
    'checkout_sessions'
  ];
begin
  foreach table_name in array tables_to_publish loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end ;
$$;
