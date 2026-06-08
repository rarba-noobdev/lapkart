create schema if not exists private;

create or replace function private.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = any(_roles)
  );
$$;

revoke all on function private.has_any_role(uuid, public.app_role[]) from public, anon, authenticated;
grant execute on function private.has_any_role(uuid, public.app_role[]) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_any_role(
    auth.uid(),
    array['owner'::public.app_role, 'admin'::public.app_role]
  );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "staff read feature flags" on public.feature_flags;
create policy "staff read feature flags"
on public.feature_flags
for select
using (
  private.has_any_role(
    (select auth.uid()),
    array[
      'owner'::public.app_role,
      'admin'::public.app_role,
      'catalog_manager'::public.app_role,
      'order_manager'::public.app_role,
      'support'::public.app_role,
      'viewer'::public.app_role
    ]
  )
);

drop policy if exists "owners manage feature flags" on public.feature_flags;
create policy "owners manage feature flags"
on public.feature_flags
for all
using (
  private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])
)
with check (
  private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])
);

insert into public.feature_flags (key, enabled, description)
values
  ('razorpay_payments', true, 'Allow Razorpay payment order creation and completion'),
  ('cod', true, 'Allow cash-on-delivery checkout'),
  ('coupons', true, 'Allow coupon validation and redemption during checkout'),
  ('shiprocket', true, 'Allow Shiprocket courier quotes and shipment creation'),
  ('new_checkout', true, 'Allow the current checkout flow'),
  ('maintenance_mode', false, 'Block checkout and admin mutations during emergency maintenance')
on conflict (key) do nothing;

create table if not exists private.rate_limit_events (
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_key_created_at_idx
on private.rate_limit_events (key, created_at desc);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  cutoff timestamptz := now() - make_interval(secs => greatest(p_window_seconds, 1));
  current_count integer;
  reset_at timestamptz;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'rate limit key is required';
  end if;

  delete from private.rate_limit_events
  where created_at < now() - interval '24 hours';

  select count(*), min(created_at) + make_interval(secs => greatest(p_window_seconds, 1))
  into current_count, reset_at
  from private.rate_limit_events
  where key = p_key
    and created_at >= cutoff;

  if current_count >= greatest(p_limit, 1) then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'resetAt', coalesce(reset_at, now() + make_interval(secs => greatest(p_window_seconds, 1)))
    );
  end if;

  insert into private.rate_limit_events (key) values (p_key);

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_limit, 1) - current_count - 1,
    'resetAt', coalesce(reset_at, now() + make_interval(secs => greatest(p_window_seconds, 1)))
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create table if not exists public.monitoring_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  message text not null,
  user_id uuid references auth.users(id) on delete set null,
  request_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.monitoring_events enable row level security;

drop policy if exists "staff read monitoring events" on public.monitoring_events;
create policy "staff read monitoring events"
on public.monitoring_events
for select
using (
  private.has_any_role(
    (select auth.uid()),
    array['owner'::public.app_role, 'admin'::public.app_role, 'viewer'::public.app_role]
  )
);

revoke insert, update, delete on public.monitoring_events from anon, authenticated;
grant select on public.monitoring_events to authenticated;
grant select, insert, update, delete on public.monitoring_events to service_role;

create table if not exists public.admin_import_jobs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('products')),
  mode text not null check (mode in ('preview', 'commit')),
  status text not null check (status in ('accepted', 'rejected', 'completed', 'failed')),
  row_count integer not null default 0 check (row_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_import_jobs enable row level security;

drop policy if exists "staff read admin import jobs" on public.admin_import_jobs;
create policy "staff read admin import jobs"
on public.admin_import_jobs
for select
using (
  private.has_any_role(
    (select auth.uid()),
    array['owner'::public.app_role, 'admin'::public.app_role, 'catalog_manager'::public.app_role]
  )
);

grant select on public.admin_import_jobs to authenticated;
grant select, insert, update, delete on public.admin_import_jobs to service_role;
