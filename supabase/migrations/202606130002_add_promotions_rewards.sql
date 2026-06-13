-- Promotions & gamification foundation. Guardrails baked in:
--  * rewards pay STORE CREDIT with expiry, never cash;
--  * the prize is drawn server-side at card creation and hidden until the
--    customer scratches (no direct table read — access is via definer RPCs);
--  * a per-promotion budget_cap auto-pauses the promotion once exhausted.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (
    type in ('coupon', 'scratch_card', 'streak', 'referral', 'flash_sale', 'festival')
  ),
  name text not null,
  config jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  budget_cap numeric,
  spent numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promotion_id uuid references public.promotions(id) on delete set null,
  type text not null,
  value numeric not null default 0,
  status text not null default 'locked' check (status in ('locked', 'available', 'redeemed', 'expired')),
  expires_at timestamptz,
  source_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  revealed_at timestamptz
);

-- One scratch card per order maximum.
create unique index if not exists customer_rewards_scratch_order_idx
  on public.customer_rewards (source_order_id)
  where type = 'scratch_card';
create index if not exists customer_rewards_user_idx
  on public.customer_rewards (user_id, created_at desc);

alter table public.store_credits add column if not exists source_promotion_id uuid
  references public.promotions(id) on delete set null;
alter table public.store_credits add column if not exists source_reward_id uuid
  references public.customer_rewards(id) on delete set null;

alter table public.products add column if not exists clearance boolean not null default false;

alter table public.promotions enable row level security;
alter table public.customer_rewards enable row level security;

-- Admins manage promotions. No anon/auth read policy: the scratch flow never
-- needs the raw config client-side, and rewards are read through definer RPCs.
drop policy if exists "admins manage promotions" on public.promotions;
create policy "admins manage promotions"
  on public.promotions for all
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Customers may not read customer_rewards directly (that would leak the prize
-- before scratching). Reads go through list_my_rewards(); writes through the
-- definer functions below. Admins can read for support.
drop policy if exists "admins read rewards" on public.customer_rewards;
create policy "admins read rewards"
  on public.customer_rewards for select
  using (private.has_role(auth.uid(), 'admin'::public.app_role));
revoke select, insert, update, delete on public.customer_rewards from anon, authenticated;

-- Draw a prize from the active scratch-card promotion and create a LOCKED card
-- for a delivered, prepaid order. Idempotent per order via the unique index.
create or replace function public.issue_scratch_card(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_promo public.promotions%rowtype;
  v_prizes jsonb;
  v_total_weight numeric := 0;
  v_roll numeric;
  v_acc numeric := 0;
  v_prize jsonb;
  v_credit numeric := 0;
  v_expiry_days int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return; end if;

  -- Prepaid + delivered only. COD orders earn no scratch card.
  if lower(coalesce(v_order.status, '')) <> 'delivered' then return; end if;
  if lower(coalesce(v_order.payment_method, '')) = 'cod' then return; end if;
  if lower(coalesce(v_order.payment_status, '')) <> 'paid' then return; end if;

  -- Already carded?
  if exists (
    select 1 from public.customer_rewards
    where source_order_id = p_order_id and type = 'scratch_card'
  ) then
    return;
  end if;

  select * into v_promo
  from public.promotions
  where type = 'scratch_card'
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (budget_cap is null or spent < budget_cap)
  order by created_at desc
  limit 1;
  if not found then return; end if;

  v_prizes := coalesce(v_promo.config -> 'prizes', '[]'::jsonb);
  if jsonb_array_length(v_prizes) = 0 then return; end if;
  v_expiry_days := coalesce((v_promo.config ->> 'expiry_days')::int, 30);

  for v_prize in select * from jsonb_array_elements(v_prizes) loop
    v_total_weight := v_total_weight + coalesce((v_prize ->> 'weight')::numeric, 0);
  end loop;
  if v_total_weight <= 0 then return; end if;

  v_roll := random() * v_total_weight;
  for v_prize in select * from jsonb_array_elements(v_prizes) loop
    v_acc := v_acc + coalesce((v_prize ->> 'weight')::numeric, 0);
    if v_roll <= v_acc then
      v_credit := coalesce((v_prize ->> 'credit')::numeric, 0);
      exit;
    end if;
  end loop;

  insert into public.customer_rewards (
    user_id, promotion_id, type, value, status, expires_at, source_order_id
  )
  values (
    v_order.user_id,
    v_promo.id,
    'scratch_card',
    v_credit,
    'locked',
    now() + make_interval(days => v_expiry_days),
    p_order_id
  );
end;
$$;

revoke all on function public.issue_scratch_card(uuid) from public, anon, authenticated;

-- Fire when an order first becomes delivered.
create or replace function public.trg_issue_scratch_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'delivered'
     and lower(coalesce(old.status, '')) is distinct from 'delivered' then
    perform public.issue_scratch_card(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists issue_scratch_card_on_delivery on public.orders;
create trigger issue_scratch_card_on_delivery
  after update of status on public.orders
  for each row execute function public.trg_issue_scratch_card();

-- Customer-facing reward list. Masks the prize value while the card is locked.
create or replace function public.list_my_rewards()
returns table (
  id uuid,
  type text,
  status text,
  value numeric,
  expires_at timestamptz,
  created_at timestamptz,
  revealed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.type,
    case when r.expires_at is not null and r.expires_at < now() then 'expired' else r.status end,
    case when r.status = 'locked' then null else r.value end,
    r.expires_at,
    r.created_at,
    r.revealed_at
  from public.customer_rewards r
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.list_my_rewards() from public, anon;
grant execute on function public.list_my_rewards() to authenticated;

-- Scratch a card: reveal the prize, issue the store credit, advance the
-- promotion budget. Returns the credit value. Idempotent — a second call on an
-- already-revealed card just returns the value without double-issuing.
create or replace function public.reveal_scratch_card(p_reward_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.customer_rewards%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_reward
  from public.customer_rewards
  where id = p_reward_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'reward not found'; end if;

  if v_reward.expires_at is not null and v_reward.expires_at < now() then
    update public.customer_rewards set status = 'expired' where id = v_reward.id;
    raise exception 'reward expired';
  end if;

  if v_reward.status <> 'locked' then
    return v_reward.value;
  end if;

  update public.customer_rewards
  set status = 'available', revealed_at = now()
  where id = v_reward.id;

  if v_reward.value > 0 then
    insert into public.store_credits (
      user_id, amount, balance, reason, expires_at, source_promotion_id, source_reward_id
    )
    values (
      v_reward.user_id,
      v_reward.value,
      v_reward.value,
      'Scratch card reward',
      v_reward.expires_at,
      v_reward.promotion_id,
      v_reward.id
    );

    if v_reward.promotion_id is not null then
      update public.promotions
      set spent = spent + v_reward.value,
          active = case
            when budget_cap is not null and spent + v_reward.value >= budget_cap then false
            else active
          end
      where id = v_reward.promotion_id;
    end if;
  end if;

  return v_reward.value;
end;
$$;

revoke all on function public.reveal_scratch_card(uuid) from public, anon;
grant execute on function public.reveal_scratch_card(uuid) to authenticated;

-- Live (non-expired) store-credit balance for the current user.
create or replace function public.my_store_credit_balance()
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(balance), 0)::numeric
  from public.store_credits
  where user_id = auth.uid()
    and balance > 0
    and (expires_at is null or expires_at > now());
$$;

revoke all on function public.my_store_credit_balance() from public, anon;
grant execute on function public.my_store_credit_balance() to authenticated;

-- Seed one scratch-card promotion (credit-only prizes, 30-day expiry). The
-- owner should set a real budget_cap from the admin before promoting heavily.
insert into public.promotions (type, name, config, budget_cap, active)
select
  'scratch_card',
  'Launch scratch cards',
  jsonb_build_object(
    'expiry_days', 30,
    'min_redeem', 500,
    'prizes', jsonb_build_array(
      jsonb_build_object('credit', 20, 'weight', 60),
      jsonb_build_object('credit', 40, 'weight', 25),
      jsonb_build_object('credit', 60, 'weight', 10),
      jsonb_build_object('credit', 100, 'weight', 5)
    )
  ),
  5000,
  true
where not exists (select 1 from public.promotions where type = 'scratch_card');
