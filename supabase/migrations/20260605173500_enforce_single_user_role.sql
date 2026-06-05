with ranked_roles as (
  select
    id,
    row_number() over (
      partition by user_id
      order by
        case when role = 'admin'::public.app_role then 0 else 1 end,
        created_at desc,
        id desc
    ) as role_rank
  from public.user_roles
)
delete from public.user_roles role_row
using ranked_roles
where role_row.id = ranked_roles.id
  and ranked_roles.role_rank > 1;

create unique index if not exists user_roles_one_role_per_user_idx
on public.user_roles (user_id);

drop policy if exists "admins read admin order events" on public.admin_order_events;
create policy "admins read admin order events"
on public.admin_order_events
for select
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "admins insert admin order events" on public.admin_order_events;
create policy "admins insert admin order events"
on public.admin_order_events
for insert
to authenticated
with check ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
