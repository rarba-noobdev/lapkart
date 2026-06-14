-- Coupon targeting: first-order-only, free-delivery type, category and pincode
-- gating. Enables launch coupons like WELCOME50 (first order) and CHENNAI
-- (free delivery for 600xxx pincodes).

alter table public.coupons drop constraint if exists coupons_discount_type_check;
alter table public.coupons add constraint coupons_discount_type_check
  check (discount_type in ('percent', 'fixed', 'free_delivery'));

alter table public.coupons add column if not exists first_order_only boolean not null default false;
alter table public.coupons add column if not exists applicable_categories text[];
alter table public.coupons add column if not exists allowed_pincode_prefix text;
