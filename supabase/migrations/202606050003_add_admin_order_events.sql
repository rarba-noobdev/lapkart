create table if not exists public.admin_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  reason text not null,
  from_state jsonb not null default '{}'::jsonb,
  to_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_order_events_type_chk check (
    event_type in (
      'manual_update',
      'manual_cancel',
      'workflow_action',
      'address_update',
      'payment_update',
      'shipping_update'
    )
  ),
  constraint admin_order_events_reason_length_chk check (
    length(trim(reason)) between 12 and 500
  )
);

alter table public.admin_order_events enable row level security;

drop policy if exists "admins read admin order events" on public.admin_order_events;
create policy "admins read admin order events"
  on public.admin_order_events
  for select
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins insert admin order events" on public.admin_order_events;
create policy "admins insert admin order events"
  on public.admin_order_events
  for insert
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create index if not exists admin_order_events_order_created_idx
  on public.admin_order_events(order_id, created_at desc);

create index if not exists admin_order_events_admin_created_idx
  on public.admin_order_events(admin_user_id, created_at desc)
  where admin_user_id is not null;

alter publication supabase_realtime add table public.admin_order_events;
