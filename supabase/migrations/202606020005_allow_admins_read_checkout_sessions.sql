begin;

create policy "admins view checkout sessions"
on public.checkout_sessions
for select
to authenticated
using (private.has_role(auth.uid(), 'admin'));

commit;
