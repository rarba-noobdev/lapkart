begin;

alter table public.products
  add column if not exists authenticity_grade text not null default 'compatible' check (authenticity_grade in ('oem','compatible','refurbished','open_box')),
  add column if not exists condition_grade text not null default 'new' check (condition_grade in ('new','open_box','refurbished','used')),
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2) not null default 18 check (gst_rate >= 0 and gst_rate <= 28),
  add column if not exists doa_policy_days integer not null default 7 check (doa_policy_days >= 0 and doa_policy_days <= 30),
  add column if not exists local_delivery_eligible boolean not null default true,
  add column if not exists cod_eligible boolean not null default true;

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  shop_name text not null check (char_length(shop_name) between 2 and 160),
  gstin text,
  business_phone text,
  billing_email text,
  billing_address text,
  city text,
  state text,
  pincode text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  pro_tier text not null default 'standard' check (pro_tier in ('standard','silver','gold','platinum')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_accounts_user_id_idx on public.business_accounts(user_id);
create index if not exists business_accounts_gstin_idx on public.business_accounts(gstin);

create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  question text not null check (char_length(question) between 3 and 800),
  answer text,
  answered_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists product_questions_product_id_idx on public.product_questions(product_id);
create index if not exists product_questions_user_id_idx on public.product_questions(user_id);

create table if not exists public.stock_notification_events (
  id uuid primary key default gen_random_uuid(),
  stock_notification_id uuid not null references public.stock_notifications(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists stock_notification_events_status_idx on public.stock_notification_events(status, created_at);
create index if not exists stock_notification_events_product_id_idx on public.stock_notification_events(product_id);

alter table public.business_accounts enable row level security;
alter table public.product_questions enable row level security;
alter table public.stock_notification_events enable row level security;

create policy "business accounts select own" on public.business_accounts for select using ((select auth.uid()) = user_id or public.is_admin());
create policy "business accounts insert own" on public.business_accounts for insert with check ((select auth.uid()) = user_id);
create policy "business accounts update own pending" on public.business_accounts for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and verification_status in ('pending','verified'));
create policy "admins manage business accounts" on public.business_accounts for all using (public.is_admin()) with check (public.is_admin());

create policy "questions public published" on public.product_questions for select using (status = 'published' or (select auth.uid()) = user_id or public.is_admin());
create policy "questions insert own" on public.product_questions for insert with check ((select auth.uid()) = user_id);
create policy "admins manage questions" on public.product_questions for all using (public.is_admin()) with check (public.is_admin());

create policy "stock events select own" on public.stock_notification_events for select using ((select auth.uid()) = user_id or email = (select auth.email()) or public.is_admin());
create policy "admins manage stock events" on public.stock_notification_events for all using (public.is_admin()) with check (public.is_admin());

create trigger business_accounts_set_updated_at before update on public.business_accounts for each row execute function public.set_updated_at();
create trigger product_questions_set_updated_at before update on public.product_questions for each row execute function public.set_updated_at();

create or replace function public.queue_stock_notification_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.stock, 0) <= 0 and coalesce(new.stock, 0) > 0 then
    insert into public.stock_notification_events (stock_notification_id, product_id, user_id, email, payload)
    select sn.id,
           sn.product_id,
           sn.user_id,
           sn.email,
           jsonb_build_object('product_id', new.id, 'title', new.title, 'stock', new.stock)
    from public.stock_notifications sn
    where sn.product_id = new.id
      and sn.status = 'active'
    on conflict do nothing;

    update public.stock_notifications
    set status = 'notified', notified_at = now()
    where product_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists products_queue_stock_notification_events on public.products;
create trigger products_queue_stock_notification_events
  after update of stock on public.products
  for each row execute function public.queue_stock_notification_events();

do $$
begin
  begin
    alter publication supabase_realtime add table public.business_accounts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.product_questions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stock_notification_events;
  exception when duplicate_object then null;
  end;
end $$;

commit;
