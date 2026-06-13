-- Referral program. Both sides earn store credit:
--  * referee: credited on their first delivered, prepaid order >= min_order;
--  * referrer: credited only after the referee's return window closes (kills
--    self-referral refund abuse), capped per rolling month.

insert into public.app_settings (key, value, description)
values (
  'referral',
  '{"credit":75,"min_order":999,"monthly_cap":10}'::jsonb,
  'Referral: both-side store credit, min order, monthly cap per referrer'
)
on conflict (key) do nothing;

alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
create unique index if not exists profiles_referral_code_idx on public.profiles (referral_code);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rewarded', 'expired')),
  referee_order_id uuid references public.orders(id) on delete set null,
  qualifies_at timestamptz,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  unique (referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, status);

alter table public.referrals enable row level security;
drop policy if exists "users read own referrals" on public.referrals;
create policy "users read own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);
revoke insert, update, delete on public.referrals from anon, authenticated;

-- Stable per-user referral code, created on first request.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select referral_code into v_code from public.profiles where id = v_uid;
  if v_code is not null then return v_code; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.profiles set referral_code = v_code where id = v_uid;
  return v_code;
end;
$$;

revoke all on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- Referee claims a code (only before their first order, once, not their own).
create or replace function public.apply_referral_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select referred_by into v_existing from public.profiles where id = v_uid;
  if v_existing is not null then return 'already_referred'; end if;

  if exists (select 1 from public.orders where user_id = v_uid) then
    return 'not_new_customer';
  end if;

  select id into v_referrer from public.profiles
  where referral_code = upper(btrim(p_code));
  if v_referrer is null then return 'invalid_code'; end if;
  if v_referrer = v_uid then return 'self_referral'; end if;

  update public.profiles set referred_by = v_referrer where id = v_uid;
  insert into public.referrals (referrer_id, referee_id, status)
  values (v_referrer, v_uid, 'pending')
  on conflict (referee_id) do nothing;
  return 'ok';
end;
$$;

revoke all on function public.apply_referral_code(text) from public, anon;
grant execute on function public.apply_referral_code(text) to authenticated;

-- On a referee's first qualifying delivered prepaid order: credit the referee
-- now, and arm the referrer reward for after the return window.
create or replace function public.qualify_referral(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_cfg jsonb;
  v_credit numeric;
  v_min numeric;
  v_window int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is null then return; end if;
  if lower(coalesce(v_order.status, '')) <> 'delivered' then return; end if;
  if lower(coalesce(v_order.payment_method, '')) = 'cod' then return; end if;

  select value into v_cfg from public.app_settings where key = 'referral';
  v_credit := coalesce((v_cfg ->> 'credit')::numeric, 75);
  v_min := coalesce((v_cfg ->> 'min_order')::numeric, 999);
  if coalesce(v_order.total, 0) < v_min then return; end if;

  select coalesce((value ->> 'return_window_days')::int, 7)
  into v_window from public.app_settings where key = 'return_window_days';
  if v_window is null then v_window := 7; end if;

  update public.referrals
  set status = 'qualified',
      referee_order_id = p_order_id,
      qualifies_at = now() + make_interval(days => v_window)
  where referee_id = v_order.user_id and status = 'pending';
  if not found then return; end if;

  -- Referee's own credit, immediately.
  insert into public.store_credits (user_id, order_id, amount, balance, reason, expires_at)
  values (
    v_order.user_id, p_order_id, v_credit, v_credit,
    'Referral welcome credit', now() + interval '30 days'
  );
end;
$$;

revoke all on function public.qualify_referral(uuid) from public, anon, authenticated;

create or replace function public.trg_qualify_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'delivered'
     and lower(coalesce(old.status, '')) is distinct from 'delivered' then
    perform public.qualify_referral(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists qualify_referral_on_delivery on public.orders;
create trigger qualify_referral_on_delivery
  after update of status on public.orders
  for each row execute function public.trg_qualify_referral();

-- Nightly: release referrer rewards whose return window has closed, respecting
-- the rolling-month cap per referrer.
create or replace function public.release_referral_rewards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_credit numeric;
  v_cap int;
  v_row public.referrals%rowtype;
  v_recent int;
begin
  select value into v_cfg from public.app_settings where key = 'referral';
  v_credit := coalesce((v_cfg ->> 'credit')::numeric, 75);
  v_cap := coalesce((v_cfg ->> 'monthly_cap')::int, 10);

  for v_row in
    select * from public.referrals
    where status = 'qualified' and qualifies_at is not null and qualifies_at <= now()
    order by qualifies_at asc
    for update
  loop
    select count(*) into v_recent
    from public.referrals
    where referrer_id = v_row.referrer_id
      and status = 'rewarded'
      and rewarded_at >= now() - interval '30 days';
    if v_recent >= v_cap then
      continue; -- cap reached this month; retried on a later run
    end if;

    insert into public.store_credits (user_id, amount, balance, reason, expires_at)
    values (
      v_row.referrer_id, v_credit, v_credit,
      'Referral reward', now() + interval '30 days'
    );
    update public.referrals
    set status = 'rewarded', rewarded_at = now()
    where id = v_row.id;
  end loop;
end;
$$;

revoke all on function public.release_referral_rewards() from public, anon, authenticated;
grant execute on function public.release_referral_rewards() to service_role;

select cron.schedule(
  'release-referral-rewards',
  '0 20 * * *',
  $$select public.release_referral_rewards();$$
);
