-- DPDP right-to-erasure intake. Users raise a deletion request; staff action it
-- with the service role (hard auth-user delete cascades personal data). Kept as
-- a request queue rather than instant self-serve delete so it is auditable and
-- so any legally required retention (e.g. tax invoices) can be honoured first.

create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id) on delete set null,
  admin_note text,
  constraint data_deletion_requests_status_chk check (
    status in ('pending', 'completed', 'rejected', 'cancelled')
  ),
  constraint data_deletion_requests_reason_length_chk check (
    reason is null or length(reason) <= 1000
  )
);

alter table public.data_deletion_requests enable row level security;

-- At most one open request per user.
create unique index if not exists data_deletion_requests_one_open_idx
  on public.data_deletion_requests(user_id)
  where status = 'pending';

create index if not exists data_deletion_requests_status_idx
  on public.data_deletion_requests(status, requested_at desc);

drop policy if exists "users read own deletion requests" on public.data_deletion_requests;
create policy "users read own deletion requests"
  on public.data_deletion_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "users raise own deletion request" on public.data_deletion_requests;
create policy "users raise own deletion request"
  on public.data_deletion_requests
  for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "users cancel own deletion request" on public.data_deletion_requests;
create policy "users cancel own deletion request"
  on public.data_deletion_requests
  for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status in ('pending', 'cancelled'));

drop policy if exists "admins read all deletion requests" on public.data_deletion_requests;
create policy "admins read all deletion requests"
  on public.data_deletion_requests
  for select
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins update deletion requests" on public.data_deletion_requests;
create policy "admins update deletion requests"
  on public.data_deletion_requests
  for update
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));
