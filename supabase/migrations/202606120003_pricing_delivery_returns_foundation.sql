-- LapKart pricing, manual delivery, compatibility, returns, and profitability foundation.
-- This adapts the agent prompt to the current SvelteKit/Supabase/manual-courier app.

create extension if not exists "pg_trgm" with schema extensions;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app settings public read" on public.app_settings;
create policy "app settings public read"
on public.app_settings
for select
to anon, authenticated
using (true);

drop policy if exists "admins manage app settings" on public.app_settings;
drop policy if exists "admins insert app settings" on public.app_settings;
create policy "admins insert app settings"
on public.app_settings
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update app settings" on public.app_settings;
create policy "admins update app settings"
on public.app_settings
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete app settings" on public.app_settings;
create policy "admins delete app settings"
on public.app_settings
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;

insert into public.app_settings (key, value, description)
values
  ('free_delivery_threshold', '2000'::jsonb, 'Tamil Nadu manual delivery is free from this subtotal.'),
  ('manual_min_delivery_fee', '50'::jsonb, 'Minimum manual courier fee in INR.'),
  ('manual_rate_per_kg', '40'::jsonb, 'Manual courier fee per chargeable kg in INR.'),
  ('manual_delivery_region', '"Tamil Nadu"'::jsonb, 'Only this region is serviceable in checkout.'),
  ('manual_cutoff_hour_ist', '17'::jsonb, 'Orders paid before this IST hour target tomorrow delivery.'),
  ('default_package_weight_kg', '0.5'::jsonb, 'Fallback package weight when product weight is missing.'),
  ('cod_fee', '40'::jsonb, 'COD handling fee in INR.'),
  ('cod_max_order_value', '4000'::jsonb, 'COD is blocked above this order value.'),
  ('return_window_days', '7'::jsonb, 'Default return request window after delivery.'),
  ('restocking_fee_pct', '20'::jsonb, 'Default restocking fee percentage for non-defect returns.'),
  ('min_margin_floor_pct', '3'::jsonb, 'Discount guard margin floor percentage.'),
  ('small_cart_fee', '0'::jsonb, 'Optional small cart fee. Kept zero under current approved rules.')
on conflict (key) do nothing;

create or replace function public.app_setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_value jsonb;
begin
  select value into v_value
  from public.app_settings
  where key = p_key;

  if v_value is null then
    return p_default;
  end if;

  if jsonb_typeof(v_value) in ('number', 'string') then
    return (v_value #>> '{}')::numeric;
  end if;

  return p_default;
exception
  when others then
    return p_default;
end;
$$;

create or replace function public.app_setting_text(p_key text, p_default text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif((select value #>> '{}' from public.app_settings where key = p_key), ''),
    p_default
  );
$$;

create table if not exists public.shipping_rate_slabs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'manual',
  zone text not null,
  min_weight_kg numeric(10,3) not null default 0,
  max_weight_kg numeric(10,3) not null,
  customer_fee numeric(10,2) not null,
  internal_cost numeric(10,2) not null,
  estimated_days integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_rate_slabs_weight_chk check (min_weight_kg >= 0 and max_weight_kg > min_weight_kg),
  constraint shipping_rate_slabs_fee_chk check (customer_fee >= 0 and internal_cost >= 0),
  constraint shipping_rate_slabs_unique unique (provider, zone, min_weight_kg, max_weight_kg)
);

alter table public.shipping_rate_slabs enable row level security;

drop policy if exists "shipping slabs public read active" on public.shipping_rate_slabs;
create policy "shipping slabs public read active"
on public.shipping_rate_slabs
for select
to anon
using (active = true);

drop policy if exists "shipping slabs authenticated read active or admin" on public.shipping_rate_slabs;
create policy "shipping slabs authenticated read active or admin"
on public.shipping_rate_slabs
for select
to authenticated
using (
  active = true
  or (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
);

drop policy if exists "admins manage shipping slabs" on public.shipping_rate_slabs;
drop policy if exists "admins insert shipping slabs" on public.shipping_rate_slabs;
create policy "admins insert shipping slabs"
on public.shipping_rate_slabs
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update shipping slabs" on public.shipping_rate_slabs;
create policy "admins update shipping slabs"
on public.shipping_rate_slabs
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete shipping slabs" on public.shipping_rate_slabs;
create policy "admins delete shipping slabs"
on public.shipping_rate_slabs
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

grant select on public.shipping_rate_slabs to anon, authenticated;
grant all on public.shipping_rate_slabs to service_role;

create index if not exists shipping_rate_slabs_lookup_idx
on public.shipping_rate_slabs(provider, zone, active, min_weight_kg, max_weight_kg);

insert into public.shipping_rate_slabs (
  provider,
  zone,
  min_weight_kg,
  max_weight_kg,
  customer_fee,
  internal_cost,
  estimated_days
)
select
  'manual',
  'tamil_nadu',
  case when kg = 1 then 0 else kg - 1 end,
  kg,
  greatest(50, kg * 40),
  greatest(50, kg * 40),
  1
from generate_series(1, 10) as kg
on conflict (provider, zone, min_weight_kg, max_weight_kg) do nothing;

alter table public.products
  add column if not exists cost_price numeric(10,2) not null default 0,
  add column if not exists selling_price numeric(10,2) not null default 0,
  add column if not exists max_discount_pct numeric(5,2) not null default 0,
  add column if not exists cod_allowed boolean not null default true,
  add column if not exists returnable boolean not null default true,
  add column if not exists is_universal boolean not null default false;

update public.products
set
  selling_price = coalesce(nullif(selling_price, 0), price, 0),
  cost_price = coalesce(nullif(cost_price, 0), price, 0),
  cod_allowed = coalesce(cod_eligible, cod_allowed, true),
  returnable = coalesce(returnable, true),
  is_universal = coalesce(is_universal, false),
  weight_kg = coalesce(nullif(weight_kg, 0), public.app_setting_numeric('default_package_weight_kg', 0.5));

alter table public.products
  alter column weight_kg set default public.app_setting_numeric('default_package_weight_kg', 0.5),
  alter column weight_kg set not null;

alter table public.products
  drop constraint if exists products_commercial_guard_chk;

alter table public.products
  add constraint products_commercial_guard_chk
  check (
    cost_price >= 0
    and selling_price >= 0
    and max_discount_pct >= 0
    and max_discount_pct <= 100
  );

create or replace function public.sync_product_commercial_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_floor_pct numeric := public.app_setting_numeric('min_margin_floor_pct', 3);
  v_margin_pct numeric := 0;
begin
  new.selling_price := coalesce(nullif(new.selling_price, 0), new.price, 0);
  new.price := coalesce(nullif(new.price, 0), new.selling_price, 0);
  new.cost_price := coalesce(new.cost_price, 0);
  new.cod_allowed := coalesce(new.cod_allowed, new.cod_eligible, true);
  new.cod_eligible := coalesce(new.cod_eligible, new.cod_allowed, true);
  new.returnable := coalesce(new.returnable, true);
  new.is_universal := coalesce(new.is_universal, false);
  new.weight_kg := coalesce(nullif(new.weight_kg, 0), public.app_setting_numeric('default_package_weight_kg', 0.5));

  if new.selling_price > 0 then
    v_margin_pct := ((new.selling_price - new.cost_price) / new.selling_price) * 100;
  end if;

  new.max_discount_pct := round(greatest(0, v_margin_pct - v_floor_pct), 2);
  return new;
end;
$$;

drop trigger if exists products_sync_commercial_fields on public.products;
create trigger products_sync_commercial_fields
before insert or update of price, selling_price, cost_price, cod_allowed, cod_eligible, returnable, is_universal, weight_kg
on public.products
for each row
execute function public.sync_product_commercial_fields();

create index if not exists products_commercial_idx
on public.products (status, category, selling_price, stock)
where status = 'active';

create table if not exists public.laptop_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.laptop_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.laptop_brands(id) on delete cascade,
  model_name text not null,
  model_no text,
  series text,
  normalized_search text generated always as (
    lower(regexp_replace(coalesce(model_name, '') || ' ' || coalesce(model_no, '') || ' ' || coalesce(series, ''), '\s+', ' ', 'g'))
  ) stored,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_compatibility (
  product_id uuid not null references public.products(id) on delete cascade,
  laptop_model_id uuid not null references public.laptop_models(id) on delete cascade,
  source text not null default 'admin',
  confidence numeric(4,3) not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  primary key (product_id, laptop_model_id),
  constraint product_compatibility_confidence_chk check (confidence >= 0 and confidence <= 1)
);

alter table public.profiles
  add column if not exists selected_laptop_model_id uuid references public.laptop_models(id) on delete set null,
  add column if not exists rto_count integer not null default 0;

create index if not exists laptop_models_brand_idx on public.laptop_models(brand_id);
create unique index if not exists laptop_models_brand_model_no_unique_idx
on public.laptop_models (brand_id, model_name, (coalesce(model_no, '')));
create index if not exists laptop_models_search_trgm_idx on public.laptop_models using gin (normalized_search extensions.gin_trgm_ops);
create index if not exists product_compatibility_model_idx on public.product_compatibility(laptop_model_id);
create index if not exists profiles_selected_laptop_model_id_idx on public.profiles(selected_laptop_model_id);

alter table public.laptop_brands enable row level security;
alter table public.laptop_models enable row level security;
alter table public.product_compatibility enable row level security;

drop policy if exists "laptop brands public read" on public.laptop_brands;
create policy "laptop brands public read"
on public.laptop_brands
for select
to anon, authenticated
using (true);

drop policy if exists "admins manage laptop brands" on public.laptop_brands;
drop policy if exists "admins insert laptop brands" on public.laptop_brands;
create policy "admins insert laptop brands"
on public.laptop_brands
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update laptop brands" on public.laptop_brands;
create policy "admins update laptop brands"
on public.laptop_brands
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete laptop brands" on public.laptop_brands;
create policy "admins delete laptop brands"
on public.laptop_brands
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "laptop models public read active" on public.laptop_models;
create policy "laptop models public read active"
on public.laptop_models
for select
to anon
using (active = true);

drop policy if exists "laptop models authenticated read active or admin" on public.laptop_models;
create policy "laptop models authenticated read active or admin"
on public.laptop_models
for select
to authenticated
using (
  active = true
  or (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
);

drop policy if exists "admins manage laptop models" on public.laptop_models;
drop policy if exists "admins insert laptop models" on public.laptop_models;
create policy "admins insert laptop models"
on public.laptop_models
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update laptop models" on public.laptop_models;
create policy "admins update laptop models"
on public.laptop_models
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete laptop models" on public.laptop_models;
create policy "admins delete laptop models"
on public.laptop_models
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "product compatibility public read" on public.product_compatibility;
create policy "product compatibility public read"
on public.product_compatibility
for select
to anon, authenticated
using (true);

drop policy if exists "admins manage product compatibility" on public.product_compatibility;
drop policy if exists "admins insert product compatibility" on public.product_compatibility;
create policy "admins insert product compatibility"
on public.product_compatibility
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update product compatibility" on public.product_compatibility;
create policy "admins update product compatibility"
on public.product_compatibility
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete product compatibility" on public.product_compatibility;
create policy "admins delete product compatibility"
on public.product_compatibility
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

grant select on public.laptop_brands, public.laptop_models, public.product_compatibility to anon, authenticated;
grant all on public.laptop_brands, public.laptop_models, public.product_compatibility to service_role;

create table if not exists public.cod_blocked_pincodes (
  pincode text primary key,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint cod_blocked_pincodes_chk check (pincode ~ '^[0-9]{6}$')
);

create table if not exists public.high_rto_pincodes (
  pincode text primary key,
  risk_points integer not null default 15,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint high_rto_pincodes_chk check (pincode ~ '^[0-9]{6}$'),
  constraint high_rto_pincodes_points_chk check (risk_points >= 0 and risk_points <= 100)
);

alter table public.cod_blocked_pincodes enable row level security;
alter table public.high_rto_pincodes enable row level security;

drop policy if exists "cod blocked public read active" on public.cod_blocked_pincodes;
create policy "cod blocked public read active"
on public.cod_blocked_pincodes
for select
to anon
using (active = true);

drop policy if exists "cod blocked authenticated read active or admin" on public.cod_blocked_pincodes;
create policy "cod blocked authenticated read active or admin"
on public.cod_blocked_pincodes
for select
to authenticated
using (
  active = true
  or (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
);

drop policy if exists "admins manage cod blocked pincodes" on public.cod_blocked_pincodes;
drop policy if exists "admins insert cod blocked pincodes" on public.cod_blocked_pincodes;
create policy "admins insert cod blocked pincodes"
on public.cod_blocked_pincodes
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update cod blocked pincodes" on public.cod_blocked_pincodes;
create policy "admins update cod blocked pincodes"
on public.cod_blocked_pincodes
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete cod blocked pincodes" on public.cod_blocked_pincodes;
create policy "admins delete cod blocked pincodes"
on public.cod_blocked_pincodes
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "high rto public read active" on public.high_rto_pincodes;
create policy "high rto public read active"
on public.high_rto_pincodes
for select
to anon
using (active = true);

drop policy if exists "high rto authenticated read active or admin" on public.high_rto_pincodes;
create policy "high rto authenticated read active or admin"
on public.high_rto_pincodes
for select
to authenticated
using (
  active = true
  or (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
);

drop policy if exists "admins manage high rto pincodes" on public.high_rto_pincodes;
drop policy if exists "admins insert high rto pincodes" on public.high_rto_pincodes;
create policy "admins insert high rto pincodes"
on public.high_rto_pincodes
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update high rto pincodes" on public.high_rto_pincodes;
create policy "admins update high rto pincodes"
on public.high_rto_pincodes
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete high rto pincodes" on public.high_rto_pincodes;
create policy "admins delete high rto pincodes"
on public.high_rto_pincodes
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

grant select on public.cod_blocked_pincodes, public.high_rto_pincodes to anon, authenticated;
grant all on public.cod_blocked_pincodes, public.high_rto_pincodes to service_role;

create table if not exists public.store_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  return_request_id uuid references public.return_requests(id) on delete set null,
  amount numeric(10,2) not null,
  balance numeric(10,2) not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint store_credits_amount_chk check (amount >= 0 and balance >= 0 and balance <= amount)
);

alter table public.store_credits enable row level security;

create index if not exists store_credits_user_id_idx on public.store_credits(user_id);
create index if not exists store_credits_order_id_idx on public.store_credits(order_id);
create index if not exists store_credits_return_request_id_idx on public.store_credits(return_request_id);

drop policy if exists "store credits select own" on public.store_credits;
create policy "store credits select own"
on public.store_credits
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
);

drop policy if exists "admins manage store credits" on public.store_credits;
drop policy if exists "admins insert store credits" on public.store_credits;
create policy "admins insert store credits"
on public.store_credits
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update store credits" on public.store_credits;
create policy "admins update store credits"
on public.store_credits
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete store credits" on public.store_credits;
create policy "admins delete store credits"
on public.store_credits
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

grant select on public.store_credits to authenticated;
grant all on public.store_credits to service_role;

create table if not exists public.product_bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  discount_type text not null default 'fixed',
  discount_value numeric(10,2) not null default 0,
  max_discount numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_bundles_discount_type_chk check (discount_type in ('fixed', 'percent')),
  constraint product_bundles_discount_value_chk check (discount_value >= 0 and (discount_type <> 'percent' or discount_value <= 100))
);

create table if not exists public.bundle_items (
  bundle_id uuid not null references public.product_bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (bundle_id, product_id),
  constraint bundle_items_qty_chk check (qty > 0 and qty <= 20)
);

create table if not exists public.bought_together_stats (
  product_a_id uuid not null references public.products(id) on delete cascade,
  product_b_id uuid not null references public.products(id) on delete cascade,
  order_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (product_a_id, product_b_id),
  constraint bought_together_pair_order_chk check (product_a_id < product_b_id),
  constraint bought_together_count_chk check (order_count >= 0)
);

create index if not exists product_bundles_active_window_idx
on public.product_bundles(active, starts_at, ends_at);
create index if not exists bundle_items_product_id_idx on public.bundle_items(product_id);
create index if not exists bought_together_stats_product_b_id_idx on public.bought_together_stats(product_b_id);
create index if not exists bought_together_stats_order_count_idx on public.bought_together_stats(order_count desc);

alter table public.product_bundles enable row level security;
alter table public.bundle_items enable row level security;
alter table public.bought_together_stats enable row level security;

drop policy if exists "active product bundles public read" on public.product_bundles;
create policy "active product bundles public read"
on public.product_bundles
for select
to anon
using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "product bundles authenticated read active or admin" on public.product_bundles;
create policy "product bundles authenticated read active or admin"
on public.product_bundles
for select
to authenticated
using (
  (
    active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  )
  or (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
);

drop policy if exists "admins manage product bundles" on public.product_bundles;
drop policy if exists "admins insert product bundles" on public.product_bundles;
create policy "admins insert product bundles"
on public.product_bundles
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update product bundles" on public.product_bundles;
create policy "admins update product bundles"
on public.product_bundles
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete product bundles" on public.product_bundles;
create policy "admins delete product bundles"
on public.product_bundles
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "bundle items public read active bundles" on public.bundle_items;
create policy "bundle items public read active bundles"
on public.bundle_items
for select
to anon
using (
  exists (
    select 1
    from public.product_bundles b
    where b.id = bundle_items.bundle_id
      and b.active = true
      and (b.starts_at is null or b.starts_at <= now())
      and (b.ends_at is null or b.ends_at >= now())
  )
);

drop policy if exists "bundle items authenticated read active or admin" on public.bundle_items;
create policy "bundle items authenticated read active or admin"
on public.bundle_items
for select
to authenticated
using (
  (select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role]))
  or exists (
    select 1
    from public.product_bundles b
    where b.id = bundle_items.bundle_id
      and b.active = true
      and (b.starts_at is null or b.starts_at <= now())
      and (b.ends_at is null or b.ends_at >= now())
  )
);

drop policy if exists "admins manage bundle items" on public.bundle_items;
drop policy if exists "admins insert bundle items" on public.bundle_items;
create policy "admins insert bundle items"
on public.bundle_items
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update bundle items" on public.bundle_items;
create policy "admins update bundle items"
on public.bundle_items
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete bundle items" on public.bundle_items;
create policy "admins delete bundle items"
on public.bundle_items
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "bought together public read" on public.bought_together_stats;
create policy "bought together public read"
on public.bought_together_stats
for select
to anon, authenticated
using (true);

drop policy if exists "admins manage bought together stats" on public.bought_together_stats;
drop policy if exists "admins insert bought together stats" on public.bought_together_stats;
create policy "admins insert bought together stats"
on public.bought_together_stats
for insert
to authenticated
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins update bought together stats" on public.bought_together_stats;
create policy "admins update bought together stats"
on public.bought_together_stats
for update
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])))
with check ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

drop policy if exists "admins delete bought together stats" on public.bought_together_stats;
create policy "admins delete bought together stats"
on public.bought_together_stats
for delete
to authenticated
using ((select private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])));

grant select on public.product_bundles, public.bundle_items, public.bought_together_stats to anon, authenticated;
grant all on public.product_bundles, public.bundle_items, public.bought_together_stats to service_role;

create or replace function public.validate_bundle_discount(p_bundle_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_bundle public.product_bundles%rowtype;
  v_subtotal numeric := 0;
  v_cost numeric := 0;
  v_discount numeric := 0;
  v_margin_pct numeric := 0;
  v_floor_pct numeric := public.app_setting_numeric('min_margin_floor_pct', 3);
begin
  select * into v_bundle
  from public.product_bundles
  where id = p_bundle_id;

  if not found then
    raise exception 'Bundle not found';
  end if;

  select
    coalesce(sum(coalesce(p.selling_price, p.price) * bi.qty), 0),
    coalesce(sum(coalesce(p.cost_price, 0) * bi.qty), 0)
  into v_subtotal, v_cost
  from public.bundle_items bi
  join public.products p on p.id = bi.product_id
  where bi.bundle_id = p_bundle_id;

  if v_bundle.discount_type = 'percent' then
    v_discount := v_subtotal * v_bundle.discount_value / 100;
  else
    v_discount := v_bundle.discount_value;
  end if;

  if v_bundle.max_discount is not null then
    v_discount := least(v_discount, v_bundle.max_discount);
  end if;

  v_discount := least(v_discount, v_subtotal);

  if (v_subtotal - v_discount) > 0 then
    v_margin_pct := ((v_subtotal - v_discount - v_cost) / (v_subtotal - v_discount)) * 100;
  end if;

  if v_subtotal > 0 and v_margin_pct < v_floor_pct then
    raise exception 'Bundle discount violates margin floor';
  end if;

  return jsonb_build_object(
    'valid', true,
    'subtotal', round(v_subtotal, 2),
    'cost', round(v_cost, 2),
    'discount', round(v_discount, 2),
    'marginPct', round(v_margin_pct, 2),
    'floorPct', v_floor_pct
  );
end;
$$;

alter table public.orders
  add column if not exists cod_fee numeric(10,2) not null default 0,
  add column if not exists cod_confirmed boolean not null default false,
  add column if not exists cod_confirmation_sent_at timestamptz,
  add column if not exists rto_risk integer not null default 0,
  add column if not exists hold_reason text;

alter table public.orders
  drop constraint if exists orders_cod_rto_guard_chk;

alter table public.orders
  add constraint orders_cod_rto_guard_chk
  check (cod_fee >= 0 and rto_risk >= 0 and rto_risk <= 100);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending',
    'processing',
    'confirmed',
    'ready_for_delivery',
    'on_hold',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancellation_requested',
    'cancelled',
    'return_requested',
    'return_approved',
    'return_received',
    'returned',
    'rto',
    'refunded'
  ));

create index if not exists orders_rto_risk_idx
on public.orders (rto_risk desc, created_at desc)
where rto_risk >= 50;

alter table public.order_items
  add column if not exists cost_price_snapshot numeric(10,2) not null default 0,
  add column if not exists selling_price_snapshot numeric(10,2) not null default 0,
  add column if not exists line_margin_snapshot numeric(10,2) not null default 0,
  add column if not exists compat_acknowledged boolean not null default false,
  add column if not exists serial_number text,
  add column if not exists dispatch_photos text[] not null default '{}',
  add column if not exists dispatch_videos text[] not null default '{}';

alter table public.return_requests
  add column if not exists reason_tier text,
  add column if not exists resolution text not null default 'replacement_first',
  add column if not exists serial_number_claimed text,
  add column if not exists deductions numeric(10,2) not null default 0,
  add column if not exists customer_video_required boolean not null default true,
  add column if not exists admin_inspection_notes text;

alter table public.return_requests
  drop constraint if exists return_requests_reason_tier_chk,
  drop constraint if exists return_requests_resolution_chk,
  drop constraint if exists return_requests_deductions_chk;

alter table public.return_requests
  add constraint return_requests_reason_tier_chk
  check (reason_tier is null or reason_tier in ('doa', 'wrong_item', 'damaged', 'compatibility', 'remorse', 'other')),
  add constraint return_requests_resolution_chk
  check (resolution in ('replacement_first', 'refund_after_inspection', 'store_credit', 'rejected')),
  add constraint return_requests_deductions_chk
  check (deductions >= 0);

create or replace function public.calc_order_charges(
  p_cart_items jsonb,
  p_pincode text,
  p_payment_mode text default 'razorpay'
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_subtotal numeric := 0;
  v_cost numeric := 0;
  v_weight numeric := 0;
  v_chargeable_kg integer := 1;
  v_delivery_fee numeric := 0;
  v_internal_shipping numeric := 0;
  v_small_cart_fee numeric := 0;
  v_cod_fee numeric := 0;
  v_free_threshold numeric := public.app_setting_numeric('free_delivery_threshold', 2000);
  v_min_fee numeric := public.app_setting_numeric('manual_min_delivery_fee', 50);
  v_rate_per_kg numeric := public.app_setting_numeric('manual_rate_per_kg', 40);
  v_default_weight numeric := public.app_setting_numeric('default_package_weight_kg', 0.5);
  v_zone text := 'unsupported';
  v_serviceable boolean := false;
  v_prefix integer := null;
begin
  if p_pincode ~ '^[0-9]{6}$' then
    v_prefix := left(p_pincode, 3)::integer;
    if v_prefix = 600 then
      v_zone := 'chennai';
      v_serviceable := true;
    elsif v_prefix between 601 and 643 then
      v_zone := 'tamil_nadu';
      v_serviceable := true;
    end if;
  end if;

  with requested as (
    select
      (item->>'id')::uuid as product_id,
      greatest(1, least(coalesce((item->>'qty')::integer, 1), 20)) as qty
    from jsonb_array_elements(coalesce(p_cart_items, '[]'::jsonb)) item
  )
  select
    coalesce(sum(coalesce(p.selling_price, p.price) * r.qty), 0),
    coalesce(sum(coalesce(p.cost_price, 0) * r.qty), 0),
    coalesce(sum(coalesce(nullif(p.weight_kg, 0), v_default_weight) * r.qty), 0)
  into v_subtotal, v_cost, v_weight
  from requested r
  join public.products p on p.id = r.product_id
  where p.status = 'active';

  if v_subtotal <= 0 then
    return jsonb_build_object(
      'serviceable', v_serviceable,
      'zone', v_zone,
      'grossSubtotal', 0,
      'customerDeliveryFee', 0,
      'ourShippingCost', 0,
      'smallCartFee', 0,
      'codFee', 0,
      'netBeforeCoupon', 0,
      'chargeableWeightKg', 0,
      'freeDeliveryRemaining', v_free_threshold,
      'pricingSource', 'manual_tn_rate_card'
    );
  end if;

  v_chargeable_kg := greatest(1, ceil(greatest(v_weight, v_default_weight))::integer);
  v_internal_shipping := greatest(v_min_fee, v_chargeable_kg * v_rate_per_kg);
  v_delivery_fee := case when v_subtotal >= v_free_threshold then 0 else v_internal_shipping end;
  v_small_cart_fee := public.app_setting_numeric('small_cart_fee', 0);
  v_cod_fee := case when lower(coalesce(p_payment_mode, '')) = 'cod' then public.app_setting_numeric('cod_fee', 40) else 0 end;

  return jsonb_build_object(
    'serviceable', v_serviceable,
    'zone', v_zone,
    'grossSubtotal', round(v_subtotal, 2),
    'customerDeliveryFee', round(v_delivery_fee, 2),
    'ourShippingCost', round(v_internal_shipping, 2),
    'smallCartFee', round(v_small_cart_fee, 2),
    'codFee', round(v_cod_fee, 2),
    'netBeforeCoupon', round(v_subtotal + v_delivery_fee + v_small_cart_fee + v_cod_fee, 2),
    'grossMarginBeforeShipping', round(v_subtotal - v_cost, 2),
    'chargeableWeightKg', v_chargeable_kg,
    'freeDeliveryRemaining', round(greatest(0, v_free_threshold - v_subtotal), 2),
    'pricingSource', 'manual_tn_rate_card'
  );
end;
$$;

create or replace function public.can_use_cod(
  p_cart_items jsonb,
  p_customer_id uuid,
  p_pincode text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_reasons text[] := '{}';
  v_cap numeric := public.app_setting_numeric('cod_max_order_value', 4000);
  v_charges jsonb;
  v_order_value numeric := 0;
  v_rto_count integer := 0;
  v_blocked_products integer := 0;
  v_acknowledged_count integer := 0;
begin
  v_charges := public.calc_order_charges(p_cart_items, p_pincode, 'razorpay');
  v_order_value := coalesce((v_charges->>'netBeforeCoupon')::numeric, 0);

  if p_pincode !~ '^[0-9]{6}$' then
    v_reasons := array_append(v_reasons, 'Enter a valid delivery pincode for COD');
  elsif exists (select 1 from public.cod_blocked_pincodes c where c.pincode = p_pincode and c.active) then
    v_reasons := array_append(v_reasons, 'COD is blocked for this pincode');
  end if;

  if v_order_value > v_cap then
    v_reasons := array_append(v_reasons, format('COD is available only up to INR %s', trim(to_char(v_cap, '999999999D99'))));
  end if;

  with requested as (
    select (item->>'id')::uuid as product_id
    from jsonb_array_elements(coalesce(p_cart_items, '[]'::jsonb)) item
  )
  select count(*)
  into v_blocked_products
  from requested r
  join public.products p on p.id = r.product_id
  where coalesce(p.cod_allowed, p.cod_eligible, true) = false
     or coalesce(p.cod_eligible, p.cod_allowed, true) = false;

  if v_blocked_products > 0 then
    v_reasons := array_append(v_reasons, 'One or more products are prepaid only');
  end if;

  select count(*)
  into v_acknowledged_count
  from jsonb_array_elements(coalesce(p_cart_items, '[]'::jsonb)) item
  where coalesce((item->>'compat_acknowledged')::boolean, false) = true;

  if v_acknowledged_count > 0 then
    v_reasons := array_append(v_reasons, 'Compatibility override orders require prepaid payment');
  end if;

  select coalesce(rto_count, 0)
  into v_rto_count
  from public.profiles
  where id = p_customer_id;

  if coalesce(v_rto_count, 0) > 0 then
    v_reasons := array_append(v_reasons, 'COD is unavailable after previous return-to-origin orders');
  end if;

  return jsonb_build_object(
    'allowed', cardinality(v_reasons) = 0,
    'reasons', to_jsonb(v_reasons),
    'cap', v_cap,
    'orderValue', round(v_order_value, 2),
    'charges', v_charges
  );
end;
$$;

create or replace function public.rto_risk_score(
  p_customer_id uuid,
  p_pincode text,
  p_cart_value numeric,
  p_payment_mode text default 'razorpay'
)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_score integer := 5;
  v_profile public.profiles%rowtype;
  v_pincode_points integer := 0;
begin
  select * into v_profile
  from public.profiles
  where id = p_customer_id;

  if lower(coalesce(p_payment_mode, '')) = 'cod' then
    v_score := v_score + 30;
  end if;

  if v_profile.id is not null then
    v_score := v_score + least(40, coalesce(v_profile.rto_count, 0) * 20);
    if v_profile.created_at > now() - interval '7 days' then
      v_score := v_score + 10;
    end if;
  end if;

  select coalesce(max(risk_points), 0)
  into v_pincode_points
  from public.high_rto_pincodes
  where pincode = p_pincode
    and active = true;

  v_score := v_score + v_pincode_points;

  if coalesce(p_cart_value, 0) > public.app_setting_numeric('cod_max_order_value', 4000) then
    v_score := v_score + 10;
  end if;

  return least(100, greatest(0, v_score));
end;
$$;

create or replace function public.record_bought_together_stats()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered' and coalesce(old.status, '') is distinct from 'delivered' then
    insert into public.bought_together_stats (product_a_id, product_b_id, order_count, updated_at)
    select
      least(i1.product_id, i2.product_id),
      greatest(i1.product_id, i2.product_id),
      1,
      now()
    from public.order_items i1
    join public.order_items i2 on i2.order_id = i1.order_id and i2.product_id > i1.product_id
    where i1.order_id = new.id
      and i1.product_id is not null
      and i2.product_id is not null
    on conflict (product_a_id, product_b_id)
    do update
      set order_count = bought_together_stats.order_count + 1,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists orders_record_bought_together_stats on public.orders;
create trigger orders_record_bought_together_stats
after update of status on public.orders
for each row
execute function public.record_bought_together_stats();

create or replace function public.complete_checkout_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_order_payload jsonb,
  p_items jsonb,
  p_payment_payload jsonb,
  p_address_payload jsonb,
  p_save_address boolean,
  p_checkout_session_razorpay_order_id text
)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_requested_count integer := 0;
  v_reserved_count integer := 0;
begin
  with requested as (
    select
      (item->>'product_id')::uuid as product_id,
      sum((item->>'qty')::integer) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    group by 1
  )
  select count(*) into v_requested_count from requested;

  if v_requested_count = 0 then
    raise exception 'Checkout items are required';
  end if;

  with requested as (
    select
      (item->>'product_id')::uuid as product_id,
      sum((item->>'qty')::integer) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    group by 1
  ),
  reserved as (
    update public.products as product
    set stock = product.stock - requested.qty,
        updated_at = now()
    from requested
    where product.id = requested.product_id
      and product.stock >= requested.qty
    returning product.id
  )
  select count(*) into v_reserved_count from reserved;

  if v_reserved_count <> v_requested_count then
    raise exception 'Insufficient stock for one or more checkout items';
  end if;

  insert into public.orders (
    id,
    user_id,
    status,
    payment_status,
    payment_method,
    subtotal,
    shipping,
    discount_total,
    total,
    cod_fee,
    cod_confirmed,
    rto_risk,
    hold_reason,
    coupon_id,
    coupon_code,
    shipping_name,
    shipping_phone,
    shipping_email,
    shipping_address,
    shipping_line1,
    shipping_line2,
    shipping_city,
    shipping_state,
    shipping_pincode,
    shipping_country,
    shipping_latitude,
    shipping_longitude,
    shipping_location_source,
    shipping_place_id,
    shipping_formatted_address,
    shipping_route_distance_meters,
    shipping_route_duration_seconds,
    shipping_estimate,
    delivery_promise_snapshot,
    shipping_courier_company_id,
    shipping_courier_name,
    shipping_service_type,
    shipping_expected_delivery_date,
    shipping_charge_estimate,
    tracking
  ) values (
    p_order_id,
    p_user_id,
    coalesce(p_order_payload->>'status', 'confirmed'),
    coalesce(p_order_payload->>'payment_status', 'paid'),
    coalesce(p_order_payload->>'payment_method', 'razorpay'),
    (p_order_payload->>'subtotal')::numeric,
    (p_order_payload->>'shipping')::numeric,
    coalesce((p_order_payload->>'discount_total')::numeric, 0),
    (p_order_payload->>'total')::numeric,
    coalesce((p_order_payload->>'cod_fee')::numeric, 0),
    coalesce((p_order_payload->>'cod_confirmed')::boolean, false),
    coalesce((p_order_payload->>'rto_risk')::integer, 0),
    nullif(p_order_payload->>'hold_reason', ''),
    nullif(p_order_payload->>'coupon_id', '')::uuid,
    nullif(p_order_payload->>'coupon_code', ''),
    p_order_payload->>'shipping_name',
    p_order_payload->>'shipping_phone',
    p_order_payload->>'shipping_email',
    p_order_payload->>'shipping_address',
    p_order_payload->>'shipping_line1',
    p_order_payload->>'shipping_line2',
    p_order_payload->>'shipping_city',
    p_order_payload->>'shipping_state',
    p_order_payload->>'shipping_pincode',
    coalesce(p_order_payload->>'shipping_country', 'India'),
    (p_order_payload->>'shipping_latitude')::numeric,
    (p_order_payload->>'shipping_longitude')::numeric,
    p_order_payload->>'shipping_location_source',
    p_order_payload->>'shipping_place_id',
    p_order_payload->>'shipping_formatted_address',
    (p_order_payload->>'shipping_route_distance_meters')::integer,
    (p_order_payload->>'shipping_route_duration_seconds')::integer,
    coalesce(p_order_payload->'shipping_estimate', '{}'::jsonb),
    coalesce(p_order_payload->'delivery_promise_snapshot', '{}'::jsonb),
    (p_order_payload->>'shipping_courier_company_id')::integer,
    p_order_payload->>'shipping_courier_name',
    coalesce(p_order_payload->>'shipping_service_type', 'standard'),
    (p_order_payload->>'shipping_expected_delivery_date')::date,
    (p_order_payload->>'shipping_charge_estimate')::numeric,
    coalesce(p_order_payload->'tracking', '[]'::jsonb)
  );

  insert into public.order_items (
    order_id,
    product_id,
    title,
    image,
    brand,
    price,
    unit_price,
    qty,
    cost_price_snapshot,
    selling_price_snapshot,
    line_margin_snapshot,
    compat_acknowledged
  )
  select
    p_order_id,
    (item->>'product_id')::uuid,
    item->>'title',
    item->>'image',
    item->>'brand',
    (item->>'price')::numeric,
    (item->>'unit_price')::numeric,
    (item->>'qty')::integer,
    coalesce(product.cost_price, 0),
    coalesce(product.selling_price, product.price, (item->>'unit_price')::numeric),
    round((coalesce((item->>'unit_price')::numeric, product.selling_price, product.price, 0) - coalesce(product.cost_price, 0)) * (item->>'qty')::integer, 2),
    coalesce((item->>'compat_acknowledged')::boolean, false)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
  left join public.products product on product.id = (item->>'product_id')::uuid;

  insert into public.payments (
    order_id,
    provider,
    method,
    amount,
    status,
    provider_order_id,
    provider_payment_id,
    provider_signature,
    raw_payload
  ) values (
    p_order_id,
    coalesce(p_payment_payload->>'provider', 'razorpay'),
    p_payment_payload->>'method',
    (p_payment_payload->>'amount')::numeric,
    coalesce(p_payment_payload->>'status', 'paid'),
    p_payment_payload->>'provider_order_id',
    p_payment_payload->>'provider_payment_id',
    p_payment_payload->>'provider_signature',
    coalesce(p_payment_payload->'raw_payload', '{}'::jsonb)
  );

  if p_save_address
    and nullif(btrim(coalesce(p_address_payload->>'line1', '')), '') is not null
    and not exists (
      select 1
      from public.addresses a
      where a.user_id = p_user_id
        and lower(btrim(coalesce(a.full_name, ''))) = lower(btrim(coalesce(p_address_payload->>'full_name', '')))
        and btrim(coalesce(a.phone, '')) = btrim(coalesce(p_address_payload->>'phone', ''))
        and lower(btrim(coalesce(a.line1, ''))) = lower(btrim(coalesce(p_address_payload->>'line1', '')))
        and lower(btrim(coalesce(a.line2, ''))) = lower(btrim(coalesce(p_address_payload->>'line2', '')))
        and lower(btrim(coalesce(a.city, ''))) = lower(btrim(coalesce(p_address_payload->>'city', '')))
        and lower(btrim(coalesce(a.state, ''))) = lower(btrim(coalesce(p_address_payload->>'state', '')))
        and btrim(coalesce(a.pincode, '')) = btrim(coalesce(p_address_payload->>'pincode', ''))
    )
  then
    insert into public.addresses (
      user_id,
      full_name,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      latitude,
      longitude,
      location_source,
      ola_place_id,
      formatted_address,
      is_default
    ) values (
      p_user_id,
      p_address_payload->>'full_name',
      p_address_payload->>'phone',
      p_address_payload->>'line1',
      p_address_payload->>'line2',
      p_address_payload->>'city',
      p_address_payload->>'state',
      p_address_payload->>'pincode',
      (p_address_payload->>'latitude')::numeric,
      (p_address_payload->>'longitude')::numeric,
      p_address_payload->>'location_source',
      p_address_payload->>'ola_place_id',
      p_address_payload->>'formatted_address',
      true
    );
  end if;

  update public.checkout_sessions
  set status = 'paid',
      order_id = p_order_id,
      updated_at = now()
  where razorpay_order_id = p_checkout_session_razorpay_order_id
    and status in ('pending', 'processing');

  if not found then
    raise exception 'Checkout session is not available for completion';
  end if;

  return p_order_id;
end;
$function$;

create or replace view public.order_profitability
with (security_invoker = true)
as
select
  o.id as order_id,
  o.created_at,
  o.status,
  o.payment_status,
  o.payment_method,
  o.subtotal,
  o.shipping,
  o.discount_total,
  coalesce(o.cod_fee, 0) as cod_fee,
  o.total,
  coalesce(sum(oi.cost_price_snapshot * oi.qty), 0) as product_cost,
  coalesce(sum(oi.line_margin_snapshot), 0) as item_margin,
  round(o.total - coalesce(o.cod_fee, 0) - coalesce(o.shipping, 0) - coalesce(sum(oi.cost_price_snapshot * oi.qty), 0), 2) as estimated_net_margin,
  coalesce(o.rto_risk, 0) as rto_risk
from public.orders o
left join public.order_items oi on oi.order_id = o.id
group by o.id;

create or replace view public.admin_pnl_30d
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  count(*) as orders,
  coalesce(sum(total), 0) as revenue,
  coalesce(sum(product_cost), 0) as product_cost,
  coalesce(sum(shipping), 0) as customer_shipping_collected,
  coalesce(sum(discount_total), 0) as discounts,
  coalesce(sum(cod_fee), 0) as cod_fees,
  coalesce(sum(estimated_net_margin), 0) as estimated_net_margin
from public.order_profitability
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

revoke all on public.order_profitability from anon, authenticated;
revoke all on public.admin_pnl_30d from anon, authenticated;
grant select on public.order_profitability, public.admin_pnl_30d to service_role;

comment on table public.app_settings is 'Database-backed commerce settings used by checkout and admin operations.';
comment on function public.calc_order_charges(jsonb, text, text) is 'Server-authoritative manual Tamil Nadu delivery and COD fee calculation.';
comment on function public.can_use_cod(jsonb, uuid, text) is 'COD gate used by checkout. Blocks high-risk, blocked-pincode, prepaid-only, and compatibility-override carts.';
comment on view public.order_profitability is 'Admin-only order margin view based on immutable order item cost snapshots.';
