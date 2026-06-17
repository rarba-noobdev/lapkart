-- Persistent admin notification feed.
-- Mirrors the access model used by public.admin_order_events: staff-only RLS via
-- private.has_role, server writes through the service role, and realtime enabled
-- so the admin dashboard bell updates live. Per-staff read state is tracked in a
-- separate table so a notification can be marked read independently by each admin.

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  severity text not null default 'info',
  title text not null,
  body text,
  order_id uuid references public.orders(id) on delete cascade,
  entity_type text,
  entity_id text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_notifications_category_chk check (
    category in (
      'order',
      'fulfillment',
      'return',
      'cancellation',
      'refund',
      'stock',
      'support',
      'system'
    )
  ),
  constraint admin_notifications_severity_chk check (
    severity in ('info', 'success', 'warning', 'critical')
  ),
  constraint admin_notifications_title_length_chk check (
    length(trim(title)) between 1 and 200
  )
);

create table if not exists public.admin_notification_reads (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;

-- Staff (owner or admin) can read the feed. Owners are included explicitly
-- because private.has_role checks an exact role and does not imply a hierarchy.
drop policy if exists "staff read admin notifications" on public.admin_notifications;
create policy "staff read admin notifications"
  on public.admin_notifications
  for select
  using (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.has_role(auth.uid(), 'owner'::public.app_role)
  );

drop policy if exists "staff insert admin notifications" on public.admin_notifications;
create policy "staff insert admin notifications"
  on public.admin_notifications
  for insert
  with check (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.has_role(auth.uid(), 'owner'::public.app_role)
  );

-- Each staff member manages only their own read receipts.
drop policy if exists "staff read own notification reads" on public.admin_notification_reads;
create policy "staff read own notification reads"
  on public.admin_notification_reads
  for select
  using (auth.uid() = user_id);

drop policy if exists "staff upsert own notification reads" on public.admin_notification_reads;
create policy "staff upsert own notification reads"
  on public.admin_notification_reads
  for insert
  with check (
    auth.uid() = user_id
    and (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      or private.has_role(auth.uid(), 'owner'::public.app_role)
    )
  );

drop policy if exists "staff delete own notification reads" on public.admin_notification_reads;
create policy "staff delete own notification reads"
  on public.admin_notification_reads
  for delete
  using (auth.uid() = user_id);

create index if not exists admin_notifications_created_idx
  on public.admin_notifications(created_at desc);

create index if not exists admin_notifications_category_created_idx
  on public.admin_notifications(category, created_at desc);

create index if not exists admin_notifications_order_idx
  on public.admin_notifications(order_id)
  where order_id is not null;

create index if not exists admin_notification_reads_user_idx
  on public.admin_notification_reads(user_id, notification_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_notifications'
  ) then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end $$;
