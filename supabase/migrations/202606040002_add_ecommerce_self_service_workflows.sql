create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_role(auth.uid(), 'admin'::app_role);
$$;

create table if not exists public.order_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','refund_pending','refunded','closed')),
  reason text not null check (char_length(reason) between 3 and 500),
  admin_note text,
  refund_id uuid,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_cancellation_one_open_per_order
  on public.order_cancellation_requests(order_id)
  where status in ('pending','approved','refund_pending');
create index if not exists order_cancellation_requests_user_id_idx on public.order_cancellation_requests(user_id);
create index if not exists order_cancellation_requests_order_id_idx on public.order_cancellation_requests(order_id);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','reverse_pickup_scheduled','received','refund_pending','refunded','closed')),
  reason text not null check (char_length(reason) between 3 and 500),
  condition_notes text,
  photos text[] not null default '{}',
  admin_note text,
  reverse_shipment_id uuid references public.shipments(id) on delete set null,
  refund_id uuid,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists return_requests_user_id_idx on public.return_requests(user_id);
create index if not exists return_requests_order_id_idx on public.return_requests(order_id);

create table if not exists public.return_request_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  qty integer not null check (qty > 0),
  reason text,
  created_at timestamptz not null default now(),
  unique(return_request_id, order_item_id)
);
create index if not exists return_request_items_return_request_id_idx on public.return_request_items(return_request_id);
create index if not exists return_request_items_order_item_id_idx on public.return_request_items(order_item_id);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  cancellation_request_id uuid references public.order_cancellation_requests(id) on delete set null,
  return_request_id uuid references public.return_requests(id) on delete set null,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_refund_id text,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','created','processed','failed','cancelled')),
  reason text,
  speed text not null default 'normal' check (speed in ('normal','optimum')),
  raw_payload jsonb not null default '{}',
  requested_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_cancellation_requests
  add constraint order_cancellation_requests_refund_id_fkey
  foreign key (refund_id) references public.refunds(id) on delete set null;
alter table public.return_requests
  add constraint return_requests_refund_id_fkey
  foreign key (refund_id) references public.refunds(id) on delete set null;
create index if not exists refunds_order_id_idx on public.refunds(order_id);
create index if not exists refunds_payment_id_idx on public.refunds(payment_id);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);
create index if not exists wishlist_items_user_id_idx on public.wishlist_items(user_id);
create index if not exists wishlist_items_product_id_idx on public.wishlist_items(product_id);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null check (char_length(body) between 3 and 2000),
  status text not null default 'published' check (status in ('pending','published','rejected')),
  verified_purchase boolean not null default false,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id, order_id)
);
create index if not exists product_reviews_product_id_idx on public.product_reviews(product_id);
create index if not exists product_reviews_user_id_idx on public.product_reviews(user_id);

create table if not exists public.stock_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('active','notified','cancelled')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique(product_id, email)
);
create index if not exists stock_notifications_product_id_idx on public.stock_notifications(product_id);
create index if not exists stock_notifications_user_id_idx on public.stock_notifications(user_id);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric not null check (discount_value > 0),
  minimum_subtotal numeric not null default 0 check (minimum_subtotal >= 0),
  max_discount numeric check (max_discount is null or max_discount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discount_amount numeric not null check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  unique(coupon_id, order_id)
);
create index if not exists coupon_redemptions_user_id_idx on public.coupon_redemptions(user_id);

create table if not exists public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  invoice_number text not null unique,
  invoice_url text,
  status text not null default 'generated' check (status in ('generated','sent','void')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_invoices_order_id_idx on public.order_invoices(order_id);

alter table public.order_cancellation_requests enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;
alter table public.refunds enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.product_reviews enable row level security;
alter table public.stock_notifications enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.order_invoices enable row level security;

create policy "cancel select own" on public.order_cancellation_requests for select using (auth.uid() = user_id);
create policy "cancel insert own" on public.order_cancellation_requests for insert with check (auth.uid() = user_id);
create policy "admins manage cancellations" on public.order_cancellation_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "returns select own" on public.return_requests for select using (auth.uid() = user_id);
create policy "returns insert own" on public.return_requests for insert with check (auth.uid() = user_id);
create policy "admins manage returns" on public.return_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "return items select own" on public.return_request_items for select using (exists (select 1 from public.return_requests rr where rr.id = return_request_id and rr.user_id = auth.uid()));
create policy "return items insert own" on public.return_request_items for insert with check (exists (select 1 from public.return_requests rr where rr.id = return_request_id and rr.user_id = auth.uid()));
create policy "admins manage return items" on public.return_request_items for all using (public.is_admin()) with check (public.is_admin());
create policy "refunds select own" on public.refunds for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "admins manage refunds" on public.refunds for all using (public.is_admin()) with check (public.is_admin());
create policy "wishlist select own" on public.wishlist_items for select using (auth.uid() = user_id);
create policy "wishlist insert own" on public.wishlist_items for insert with check (auth.uid() = user_id);
create policy "wishlist delete own" on public.wishlist_items for delete using (auth.uid() = user_id);
create policy "admins view wishlists" on public.wishlist_items for select using (public.is_admin());
create policy "reviews public published" on public.product_reviews for select using (status = 'published' or auth.uid() = user_id or public.is_admin());
create policy "reviews insert own" on public.product_reviews for insert with check (auth.uid() = user_id);
create policy "reviews update own" on public.product_reviews for update using (auth.uid() = user_id and status in ('pending','published')) with check (auth.uid() = user_id);
create policy "admins manage reviews" on public.product_reviews for all using (public.is_admin()) with check (public.is_admin());
create policy "stock notifications select own" on public.stock_notifications for select using (auth.uid() = user_id or email = auth.email());
create policy "stock notifications insert own" on public.stock_notifications for insert with check (user_id is null or auth.uid() = user_id);
create policy "stock notifications update own" on public.stock_notifications for update using (auth.uid() = user_id or email = auth.email()) with check (auth.uid() = user_id or email = auth.email());
create policy "admins manage stock notifications" on public.stock_notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "active coupons readable" on public.coupons for select using (active = true or public.is_admin());
create policy "admins manage coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());
create policy "coupon redemptions select own" on public.coupon_redemptions for select using (auth.uid() = user_id or public.is_admin());
create policy "admins manage coupon redemptions" on public.coupon_redemptions for all using (public.is_admin()) with check (public.is_admin());
create policy "invoices select own" on public.order_invoices for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()) or public.is_admin());
create policy "admins manage invoices" on public.order_invoices for all using (public.is_admin()) with check (public.is_admin());

create trigger order_cancellation_requests_set_updated_at before update on public.order_cancellation_requests for each row execute function public.set_updated_at();
create trigger return_requests_set_updated_at before update on public.return_requests for each row execute function public.set_updated_at();
create trigger refunds_set_updated_at before update on public.refunds for each row execute function public.set_updated_at();
create trigger product_reviews_set_updated_at before update on public.product_reviews for each row execute function public.set_updated_at();
create trigger coupons_set_updated_at before update on public.coupons for each row execute function public.set_updated_at();
create trigger order_invoices_set_updated_at before update on public.order_invoices for each row execute function public.set_updated_at();

do $$
declare
  table_name text;
  tables_to_publish text[] := array[
    'order_cancellation_requests',
    'return_requests',
    'return_request_items',
    'refunds',
    'wishlist_items',
    'product_reviews',
    'stock_notifications',
    'coupons',
    'coupon_redemptions',
    'order_invoices'
  ];
begin
  foreach table_name in array tables_to_publish loop
    if to_regclass(format('public.%I', table_name)) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
