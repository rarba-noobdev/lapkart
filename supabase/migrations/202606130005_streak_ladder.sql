-- Repeat-purchase ladder. Each kept (delivered, non-returned) order advances a
-- streak; crossing a ladder milestone issues expiring store credit. All
-- store-credit, all server-side, idempotent (Nth streak reward = Nth milestone).

insert into public.app_settings (key, value, description)
values (
  'streak_ladder',
  '[{"n":2,"credit":30},{"n":3,"credit":50},{"n":5,"credit":150}]'::jsonb,
  'Repeat-purchase ladder: deliver count -> store credit reward'
)
on conflict (key) do nothing;

create or replace function public.issue_streak_rewards(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivered int;
  v_issued int;
  v_ladder jsonb;
  v_step jsonb;
  v_credit numeric;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return; end if;
  if v_order.user_id is null then return; end if;

  select value into v_ladder from public.app_settings where key = 'streak_ladder';
  if v_ladder is null or jsonb_array_length(v_ladder) = 0 then return; end if;

  -- Kept orders only (delivered and not later returned/refunded/cancelled).
  select count(*) into v_delivered
  from public.orders
  where user_id = v_order.user_id
    and lower(coalesce(status, '')) = 'delivered';

  select count(*) into v_issued
  from public.customer_rewards
  where user_id = v_order.user_id and type = 'streak';

  -- Issue every milestone now reached but not yet rewarded.
  while v_issued < jsonb_array_length(v_ladder) loop
    v_step := v_ladder -> v_issued;
    if v_delivered < coalesce((v_step ->> 'n')::int, 999999) then
      exit;
    end if;
    v_credit := coalesce((v_step ->> 'credit')::numeric, 0);

    insert into public.customer_rewards (user_id, type, value, status, expires_at, source_order_id)
    values (
      v_order.user_id, 'streak', v_credit, 'available',
      now() + interval '30 days', p_order_id
    );

    if v_credit > 0 then
      insert into public.store_credits (user_id, order_id, amount, balance, reason, expires_at)
      values (
        v_order.user_id, p_order_id, v_credit, v_credit,
        'Repeat-purchase reward', now() + interval '30 days'
      );
    end if;

    v_issued := v_issued + 1;
  end loop;
end;
$$;

revoke all on function public.issue_streak_rewards(uuid) from public, anon, authenticated;

create or replace function public.trg_issue_streak_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'delivered'
     and lower(coalesce(old.status, '')) is distinct from 'delivered' then
    perform public.issue_streak_rewards(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists issue_streak_on_delivery on public.orders;
create trigger issue_streak_on_delivery
  after update of status on public.orders
  for each row execute function public.trg_issue_streak_rewards();

-- Profile progress: delivered count + the next milestone the customer is
-- working toward (null target = top of the ladder reached).
create or replace function public.my_streak_progress()
returns table (delivered int, next_target int, next_credit numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ladder jsonb;
  v_delivered int;
  v_step jsonb;
begin
  if auth.uid() is null then
    delivered := 0; next_target := null; next_credit := null; return next;
  end if;

  select count(*) into v_delivered
  from public.orders
  where user_id = auth.uid() and lower(coalesce(status, '')) = 'delivered';

  select value into v_ladder from public.app_settings where key = 'streak_ladder';

  delivered := v_delivered;
  next_target := null;
  next_credit := null;
  if v_ladder is not null then
    for v_step in select * from jsonb_array_elements(v_ladder) loop
      if v_delivered < coalesce((v_step ->> 'n')::int, 0) then
        next_target := (v_step ->> 'n')::int;
        next_credit := (v_step ->> 'credit')::numeric;
        exit;
      end if;
    end loop;
  end if;
  return next;
end;
$$;

revoke all on function public.my_streak_progress() from public, anon;
grant execute on function public.my_streak_progress() to authenticated;
