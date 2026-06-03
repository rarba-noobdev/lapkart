begin;

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  razorpay_order_id text not null unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping numeric(12,2) not null check (shipping >= 0),
  total numeric(12,2) not null check (total >= 0),
  items jsonb not null,
  address jsonb not null,
  delivery_estimate jsonb not null,
  selected_courier jsonb not null,
  save_address boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'expired', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkout_sessions enable row level security;

create index if not exists checkout_sessions_user_id_idx
  on public.checkout_sessions(user_id);
create index if not exists checkout_sessions_expires_at_idx
  on public.checkout_sessions(expires_at);
create unique index if not exists payments_provider_order_id_unique
  on public.payments(provider_order_id)
  where provider_order_id is not null;
create unique index if not exists payments_provider_payment_id_unique
  on public.payments(provider_payment_id)
  where provider_payment_id is not null;

drop policy if exists "orders insert own" on public.orders;
drop policy if exists "items insert own order" on public.order_items;
drop policy if exists "payments insert own order" on public.payments;

comment on table public.checkout_sessions is
  'Server-owned checkout sessions tying Razorpay order ids to verified cart totals before paid orders are created.';
comment on table public.orders is
  'Paid checkout orders are inserted by the backend service role only after Razorpay signature verification.';
comment on table public.order_items is
  'Order items are inserted by the backend service role from database product prices, not from browser payloads.';
comment on table public.payments is
  'Payment rows are inserted by the backend service role only after server-side payment verification.';

commit;
