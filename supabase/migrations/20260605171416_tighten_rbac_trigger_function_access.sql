drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "admins select profiles" on public.profiles;
create policy "profiles select own or admin"
on public.profiles
for select
to authenticated
using (
  ((select auth.uid()) = id)
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;
create policy "profiles update own or admin"
on public.profiles
for update
to authenticated
using (
  ((select auth.uid()) = id)
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
)
with check (
  ((select auth.uid()) = id)
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

revoke execute on function public.prevent_profile_phone_change_after_order() from public, anon, authenticated;
revoke execute on function public.prevent_last_admin_role_removal() from public, anon, authenticated;
