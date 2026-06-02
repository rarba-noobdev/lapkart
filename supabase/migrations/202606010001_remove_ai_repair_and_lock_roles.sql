begin;

drop table if exists public.component_detections cascade;
drop table if exists public.ai_predictions cascade;
drop table if exists public.repair_requests cascade;
drop table if exists public.repair_bookings cascade;
drop table if exists public.trade_in_requests cascade;

alter table public.products drop column if exists ai_tags;

drop type if exists public.repair_status cascade;

insert into public.user_roles (user_id, role)
select id, 'user'::public.app_role
from auth.users
on conflict (user_id, role) do nothing;

delete from public.user_roles user_role
using public.user_roles admin_role
where user_role.user_id = admin_role.user_id
  and user_role.role = 'user'::public.app_role
  and admin_role.role = 'admin'::public.app_role;

alter table public.user_roles drop constraint if exists user_roles_user_id_role_key;
create unique index if not exists user_roles_one_role_per_user_idx on public.user_roles(user_id);

drop policy if exists "admins manage roles" on public.user_roles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop table if exists public.users cascade;
drop type if exists public.user_role cascade;

commit;
