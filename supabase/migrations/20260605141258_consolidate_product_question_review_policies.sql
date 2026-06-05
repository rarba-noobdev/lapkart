drop policy if exists "admins manage products" on public.products;
drop policy if exists "admins manage questions" on public.product_questions;
drop policy if exists "questions insert own" on public.product_questions;
drop policy if exists "questions public published" on public.product_questions;
drop policy if exists "admins manage reviews" on public.product_reviews;
drop policy if exists "reviews insert own" on public.product_reviews;
drop policy if exists "reviews public published" on public.product_reviews;
drop policy if exists "reviews update own" on public.product_reviews;

create policy "admins insert products"
on public.products
for insert
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins update products"
on public.products
for update
using ((select private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins delete products"
on public.products
for delete
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "questions select published own or admin"
on public.product_questions
for select
using (
  status = 'published'
  or user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::app_role))
);

create policy "questions insert own or admin"
on public.product_questions
for insert
with check (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::app_role))
);

create policy "admins update questions"
on public.product_questions
for update
using ((select private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "admins delete questions"
on public.product_questions
for delete
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));

create policy "reviews select published own or admin"
on public.product_reviews
for select
using (
  status = 'published'
  or user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::app_role))
);

create policy "reviews insert own or admin"
on public.product_reviews
for insert
with check (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::app_role))
);

create policy "reviews update own or admin"
on public.product_reviews
for update
using (
  (user_id = (select auth.uid()) and status = any (array['pending'::text, 'published'::text]))
  or (select private.has_role((select auth.uid()), 'admin'::app_role))
)
with check (
  user_id = (select auth.uid())
  or (select private.has_role((select auth.uid()), 'admin'::app_role))
);

create policy "admins delete reviews"
on public.product_reviews
for delete
using ((select private.has_role((select auth.uid()), 'admin'::app_role)));
