create extension if not exists "pgcrypto";
create extension if not exists "postgis";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('customer', 'vendor', 'delivery_partner', 'admin', 'super_admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'vendor_status') then
    create type public.vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'repair_status') then
    create type public.repair_status as enum ('requested', 'diagnosed', 'assigned', 'in_repair', 'ready', 'delivered', 'cancelled');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  banned_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id),
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  business_name text not null,
  gstin text,
  status public.vendor_status not null default 'pending',
  documents jsonb not null default '[]',
  rating numeric(3,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'available',
  vehicle_type text,
  current_location geography(point),
  earnings numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists vendor_id uuid references public.vendors(id) on delete set null;
alter table public.products add column if not exists category_id uuid references public.categories(id);
alter table public.products add column if not exists description text;
alter table public.products add column if not exists images text[] default '{}';
alter table public.products add column if not exists source_url text;
alter table public.products add column if not exists sku text unique;
alter table public.products add column if not exists ai_tags text[] default '{}';
alter table public.products add column if not exists search_keywords text[] default '{}';
alter table public.products add column if not exists status text not null default 'active';
alter table public.products add column if not exists updated_at timestamptz not null default now();

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  saved_for_later boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

alter table public.orders add column if not exists vendor_id uuid references public.vendors(id);
alter table public.orders add column if not exists delivery_partner_id uuid references public.delivery_partners(id);
alter table public.orders add column if not exists tracking jsonb not null default '[]';
alter table public.orders add column if not exists risk_score integer not null default 0;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

alter table public.order_items add column if not exists unit_price numeric(12,2);
update public.order_items set unit_price = price where unit_price is null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'razorpay',
  method text,
  amount numeric(12,2),
  status text not null default 'created',
  provider_order_id text,
  provider_payment_id text,
  provider_signature text,
  raw_payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text,
  images text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.repair_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  assigned_vendor_id uuid references public.vendors(id),
  technician_user_id uuid references auth.users(id),
  status public.repair_status not null default 'requested',
  laptop_model text,
  issue_description text,
  images text[] default '{}',
  ai_diagnosis jsonb not null default '{}',
  estimated_cost numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  channel text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  prediction_type text not null,
  input_url text,
  output jsonb not null,
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  invoice_number text not null unique,
  invoice_url text,
  tax_breakup jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists products_search_idx on public.products using gin (to_tsvector('english', title || ' ' || brand || ' ' || coalesce(description, '')));
create index if not exists products_category_idx on public.products(category);
create index if not exists orders_user_status_idx on public.orders(user_id, status);
create index if not exists repair_requests_user_status_idx on public.repair_requests(user_id, status);
create index if not exists ai_predictions_type_idx on public.ai_predictions(prediction_type);

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.vendors enable row level security;
alter table public.delivery_partners enable row level security;
alter table public.reviews enable row level security;
alter table public.repair_requests enable row level security;
alter table public.wishlists enable row level security;
alter table public.carts enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_predictions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

insert into public.categories(name, slug) values
  ('Gaming Laptops', 'gaming_laptops'),
  ('Business Laptops', 'business_laptops'),
  ('Student Laptops', 'student_laptops'),
  ('Creator Laptops', 'creator_laptops'),
  ('RAM', 'ram'),
  ('SSD', 'ssd'),
  ('HDD', 'hdd'),
  ('Motherboard', 'motherboards'),
  ('Processor', 'processors'),
  ('Battery', 'batteries'),
  ('Keyboard', 'keyboards'),
  ('Screen', 'displays'),
  ('Fan', 'cooling'),
  ('Speaker', 'speakers'),
  ('Webcam', 'webcams'),
  ('Charger', 'chargers'),
  ('Touchpad', 'touchpads'),
  ('Mouse', 'mouse'),
  ('Headset', 'headset'),
  ('Cooling Pad', 'cooling_pad'),
  ('Docking Station', 'docking_station')
on conflict (slug) do nothing;
