begin;

revoke execute on function public.queue_stock_notification_events() from public;
revoke execute on function public.queue_stock_notification_events() from anon, authenticated;

commit;
