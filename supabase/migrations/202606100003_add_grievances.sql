-- Consumer-protection grievance redressal. Customers raise complaints; staff
-- acknowledge and resolve them with status tracking. created_at + the published
-- SLA (acknowledge within 48h, resolve within 30 days) drive the admin queue.

create table if not exists public.grievances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  resolution_note text,
  assigned_to uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grievances_category_chk check (
    category in ('order', 'delivery', 'payment', 'refund', 'product', 'privacy', 'other')
  ),
  constraint grievances_status_chk check (
    status in ('open', 'in_progress', 'resolved', 'closed')
  ),
  constraint grievances_subject_length_chk check (length(trim(subject)) between 4 and 160),
  constraint grievances_description_length_chk check (length(trim(description)) between 10 and 4000)
);

alter table public.grievances enable row level security;

create index if not exists grievances_user_created_idx
  on public.grievances(user_id, created_at desc);

create index if not exists grievances_status_created_idx
  on public.grievances(status, created_at desc);

drop policy if exists "users read own grievances" on public.grievances;
create policy "users read own grievances"
  on public.grievances
  for select
  using (auth.uid() = user_id);

drop policy if exists "users raise own grievances" on public.grievances;
create policy "users raise own grievances"
  on public.grievances
  for insert
  with check (auth.uid() = user_id and status = 'open');

drop policy if exists "admins read all grievances" on public.grievances;
create policy "admins read all grievances"
  on public.grievances
  for select
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins update grievances" on public.grievances;
create policy "admins update grievances"
  on public.grievances
  for update
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop trigger if exists grievances_set_updated_at on public.grievances;
create trigger grievances_set_updated_at
  before update on public.grievances
  for each row execute function public.set_updated_at();
