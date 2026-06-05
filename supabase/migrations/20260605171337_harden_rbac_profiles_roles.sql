drop policy if exists "profiles insert own" on public.profiles;

drop policy if exists "admins select profiles" on public.profiles;
create policy "admins select profiles"
on public.profiles
for select
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles"
on public.profiles
for update
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins insert roles" on public.user_roles;
create policy "admins insert roles"
on public.user_roles
for insert
to authenticated
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins update roles" on public.user_roles;
create policy "admins update roles"
on public.user_roles
for update
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins delete roles" on public.user_roles;
create policy "admins delete roles"
on public.user_roles
for delete
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create table if not exists public.admin_user_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('profile_update', 'role_update', 'account_update')),
  reason text not null default 'Admin account update' check (length(trim(reason)) >= 12 and length(trim(reason)) <= 500),
  from_state jsonb not null default '{}'::jsonb,
  to_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_user_events enable row level security;

drop policy if exists "admins read admin user events" on public.admin_user_events;
create policy "admins read admin user events"
on public.admin_user_events
for select
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins insert admin user events" on public.admin_user_events;
create policy "admins insert admin user events"
on public.admin_user_events
for insert
to authenticated
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

create index if not exists admin_user_events_target_user_id_created_at_idx
on public.admin_user_events (target_user_id, created_at desc);

create index if not exists admin_user_events_admin_user_id_created_at_idx
on public.admin_user_events (admin_user_id, created_at desc);

create or replace function public.prevent_profile_phone_change_after_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.phone is distinct from new.phone and exists (
    select 1 from public.orders where user_id = old.id limit 1
  ) then
    raise exception 'Phone number is locked after this customer has placed an order';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_phone_lock_after_order on public.profiles;
create trigger profiles_phone_lock_after_order
before update of phone on public.profiles
for each row
execute function public.prevent_profile_phone_change_after_order();

create or replace function public.prevent_last_admin_role_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_admin_count integer;
begin
  if (
    tg_op = 'UPDATE'
    and old.role = 'admin'::public.app_role
    and new.role <> 'admin'::public.app_role
  ) or (
    tg_op = 'DELETE'
    and old.role = 'admin'::public.app_role
  ) then
    select count(*)
      into other_admin_count
      from public.user_roles
      where role = 'admin'::public.app_role
        and user_id <> old.user_id;

    if other_admin_count < 1 then
      raise exception 'At least one admin account must remain';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists user_roles_keep_one_admin on public.user_roles;
create trigger user_roles_keep_one_admin
before update or delete on public.user_roles
for each row
execute function public.prevent_last_admin_role_removal();

do $$
begin
  alter publication supabase_realtime add table public.admin_user_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
