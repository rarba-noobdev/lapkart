drop policy if exists "admins manage refunds" on public.refunds;
drop policy if exists "refunds select own" on public.refunds;
drop policy if exists "admins manage returns" on public.return_requests;
drop policy if exists "returns select own" on public.return_requests;
drop policy if exists "returns insert own" on public.return_requests;
drop policy if exists "admins manage return items" on public.return_request_items;
drop policy if exists "return items select own" on public.return_request_items;
drop policy if exists "return items insert own" on public.return_request_items;

create policy "refunds select own or admin"
on public.refunds
for select
using (
  (select private.has_role((select auth.uid()), 'admin'::app_role))
  or exists (
    select 1
    from public.orders o
    where o.id = refunds.order_id
      and o.user_id = (select auth.uid())
  )
);

create policy "admins insert refunds"
on public.refunds
for insert
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins update refunds"
on public.refunds
for update
using ((select private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins delete refunds"
on public.refunds
for delete
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "returns select own or admin"
on public.return_requests
for select
using (
  (select private.has_role((select auth.uid()), 'admin'::app_role))
  or user_id = (select auth.uid())
);

create policy "returns insert own or admin"
on public.return_requests
for insert
with check (
  (select private.has_role((select auth.uid()), 'admin'::app_role))
  or user_id = (select auth.uid())
);

create policy "admins update returns"
on public.return_requests
for update
using ((select private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins delete returns"
on public.return_requests
for delete
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "return items select own or admin"
on public.return_request_items
for select
using (
  (select private.has_role((select auth.uid()), 'admin'::app_role))
  or exists (
    select 1
    from public.return_requests rr
    where rr.id = return_request_items.return_request_id
      and rr.user_id = (select auth.uid())
  )
);

create policy "return items insert own or admin"
on public.return_request_items
for insert
with check (
  (select private.has_role((select auth.uid()), 'admin'::app_role))
  or exists (
    select 1
    from public.return_requests rr
    where rr.id = return_request_items.return_request_id
      and rr.user_id = (select auth.uid())
  )
);

create policy "admins update return items"
on public.return_request_items
for update
using ((select private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins delete return items"
on public.return_request_items
for delete
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));
