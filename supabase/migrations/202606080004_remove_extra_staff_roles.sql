update public.user_roles
set role = 'user'::public.app_role
where role::text in ('catalog_manager', 'order_manager', 'support', 'viewer');

create or replace function private.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = any(_roles)
      and role in ('owner'::public.app_role, 'admin'::public.app_role)
  );
$$;

drop policy if exists "staff read feature flags" on public.feature_flags;
create policy "staff read feature flags"
on public.feature_flags
for select
using (
  private.has_any_role(
    (select auth.uid()),
    array['owner'::public.app_role, 'admin'::public.app_role]
  )
);

drop policy if exists "staff read monitoring events" on public.monitoring_events;
create policy "staff read monitoring events"
on public.monitoring_events
for select
using (
  private.has_any_role(
    (select auth.uid()),
    array['owner'::public.app_role, 'admin'::public.app_role]
  )
);

drop policy if exists "staff read admin import jobs" on public.admin_import_jobs;
create policy "staff read admin import jobs"
on public.admin_import_jobs
for select
using (
  private.has_any_role(
    (select auth.uid()),
    array['owner'::public.app_role, 'admin'::public.app_role]
  )
);
