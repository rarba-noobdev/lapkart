create policy "payments select own order"
  on public.payments
  for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "payments insert own order"
  on public.payments
  for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );
