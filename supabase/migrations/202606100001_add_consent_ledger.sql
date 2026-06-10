-- DPDP consent ledger. Append-only: every grant or withdrawal is a new row,
-- so the full consent history is preserved. Current state for a purpose is the
-- most recent row per (user_id, purpose).

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  granted boolean not null,
  policy_version text not null,
  source text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint user_consents_purpose_chk check (
    purpose in (
      'terms_privacy',
      'marketing_email',
      'marketing_whatsapp'
    )
  ),
  constraint user_consents_source_chk check (
    source in ('signup', 'profile', 'checkout')
  )
);

alter table public.user_consents enable row level security;

drop policy if exists "users read own consents" on public.user_consents;
create policy "users read own consents"
  on public.user_consents
  for select
  using (auth.uid() = user_id);

drop policy if exists "admins read all consents" on public.user_consents;
create policy "admins read all consents"
  on public.user_consents
  for select
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- No browser INSERT/UPDATE/DELETE policies: writes go exclusively through the
-- record_consent() definer function below, which stamps auth.uid() server-side
-- so a user can never forge a consent row for another user.
revoke insert, update, delete on public.user_consents from anon, authenticated;

create index if not exists user_consents_user_purpose_created_idx
  on public.user_consents(user_id, purpose, created_at desc);

create or replace function public.record_consent(
  p_purpose text,
  p_granted boolean,
  p_policy_version text,
  p_source text,
  p_user_agent text default null
)
returns public.user_consents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_consents;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.user_consents (user_id, purpose, granted, policy_version, source, user_agent)
  values (v_uid, p_purpose, p_granted, p_policy_version, p_source, p_user_agent)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_consent(text, boolean, text, text, text) from public;
grant execute on function public.record_consent(text, boolean, text, text, text) to authenticated;
