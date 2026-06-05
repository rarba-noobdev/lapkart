drop policy if exists "admins manage business accounts" on public.business_accounts;
drop policy if exists "business accounts insert own" on public.business_accounts;
drop policy if exists "business accounts select own" on public.business_accounts;
drop policy if exists "business accounts update own pending" on public.business_accounts;

create policy "business accounts select own or admin"
on public.business_accounts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "business accounts insert own or admin"
on public.business_accounts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "business accounts update own pending or admin"
on public.business_accounts
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
)
with check (
  (user_id = (select auth.uid()) and verification_status in ('pending', 'verified'))
  or (select private.has_role((select auth.uid()), 'admin'::public.app_role))
);

create policy "admins delete business accounts"
on public.business_accounts
for delete
to authenticated
using ((select private.has_role((select auth.uid()), 'admin'::public.app_role)));
