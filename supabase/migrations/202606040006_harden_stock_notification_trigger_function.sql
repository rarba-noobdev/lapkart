begin;

revoke execute on function public.queue_stock_notification_events() from anon, authenticated;

create index if not exists product_questions_answered_by_idx
  on public.product_questions(answered_by);
create index if not exists stock_notification_events_stock_notification_id_idx
  on public.stock_notification_events(stock_notification_id);
create index if not exists stock_notification_events_user_id_idx
  on public.stock_notification_events(user_id);

drop policy if exists "admins manage stock events" on public.stock_notification_events;
create policy "admins insert stock events" on public.stock_notification_events
  for insert with check (public.is_admin());
create policy "admins update stock events" on public.stock_notification_events
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admins delete stock events" on public.stock_notification_events
  for delete using (public.is_admin());

commit;
