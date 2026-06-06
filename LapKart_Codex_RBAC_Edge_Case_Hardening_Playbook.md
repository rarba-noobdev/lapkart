# LapKart Codex Agent Playbook: RBAC, Edge Cases, and Vibe-Coded Site Hardening

**Project:** LapKart  
**Stack:** Svelte 5, SvelteKit 2, Supabase Postgres/Auth/Storage/Realtime, Supabase Edge Function API, Razorpay, Shiprocket, Ola Maps  
**Primary goal:** Convert the current LapKart ecommerce app into a backend-enforced, edge-case-safe, role-aware system where frontend UI gating is only a convenience layer, not the security boundary.

---

## 0. How Codex Should Use This File

This file is written as a work order for a coding agent. Do **not** implement everything in one uncontrolled pass.

Use this sequence:

1. Read `AGENTS.md`, `MIGRATION_STATUS.md`, `package.json`, `src/routes`, `src/lib`, and `supabase/functions/api`.
2. Create an implementation inventory before editing code.
3. Add database constraints, helper functions, triggers, RLS policies, and RPC/service endpoints in small migrations.
4. Add backend tests and negative tests before relying on UI changes.
5. Add frontend UI gating only after backend enforcement exists.
6. Run `npm run check` after each meaningful batch.
7. Do not treat `npm run build` failure caused by the known Windows/Vercel adapter `EPERM` symlink issue as an application logic failure if client/server compilation already succeeded.

**Never assume the browser payload is trustworthy.** The schema already notes that paid checkout orders and payment rows are backend/service-role owned. Preserve and strengthen that rule.

---

## 1. Current Schema Inventory

The pasted schema contains **29 tables**:

- `user_roles`
- `profiles`
- `products`
- `addresses`
- `orders`
- `order_items`
- `payments`
- `shipping_pickup_locations`
- `shipments`
- `shipment_packages`
- `shipment_events`
- `shipping_batches`
- `shipping_batch_items`
- `checkout_sessions`
- `order_cancellation_requests`
- `return_requests`
- `return_request_items`
- `refunds`
- `wishlist_items`
- `product_reviews`
- `stock_notifications`
- `coupons`
- `coupon_redemptions`
- `order_invoices`
- `business_accounts`
- `product_questions`
- `stock_notification_events`
- `admin_order_events`
- `admin_user_events`

Important schema observations:

- `orders` are the central commerce record.
- `order_items` are server-owned snapshots derived from database product prices, not browser totals.
- `checkout_sessions` tie Razorpay order IDs to verified cart totals before order creation.
- `payments` are inserted only after server-side verification.
- `shipments`, `shipment_packages`, `shipment_events`, `shipping_batches`, and `shipping_batch_items` support Shiprocket workflows.
- `order_cancellation_requests`, `return_requests`, `return_request_items`, and `refunds` support post-order lifecycle flows.
- `admin_order_events` and `admin_user_events` provide audit-log style tables.
- Missing or under-specified areas: notification outbox, canonical status enums/check constraints, stock reservation/movement tables, provider webhook idempotency, and explicit immutable triggers for order snapshots.

---

## 2. Research Summary: Where Vibe-Coded Ecommerce Sites Usually Go Wrong

Use this section as a threat model. The problem with vibe-coded apps is rarely that they cannot render pages. The problem is that they often render correct-looking pages while missing non-visible invariants: authorization, data immutability, concurrency control, idempotency, provider callback verification, and auditability.

### 2.1 Research-backed risk patterns

1. **Broken object-level authorization is the default failure mode of rushed APIs.** OWASP API Security Top 10 2023 lists Broken Object Level Authorization as API1 and says APIs expose endpoints that handle object identifiers, so every function that accesses a data source using a user-supplied ID needs object-level authorization checks.
2. **Property-level authorization is commonly missed.** OWASP API3:2023 combines excessive data exposure and mass assignment under Broken Object Property Level Authorization, which is exactly what happens when apps allow arbitrary profile, order, payment, or admin fields to be patched from the browser.
3. **Function-level authorization breaks when admin and user code paths share endpoints.** OWASP API5:2023 warns that complex policies and unclear admin/user separation lead to access to other users' resources or admin functions.
4. **Third-party integrations are often trusted too much.** OWASP API10:2023 highlights unsafe consumption of APIs; LapKart should treat Shiprocket/Ola/Razorpay data as untrusted until validated, normalized, and stored through controlled service endpoints.
5. **Supabase tables exposed to browser clients need RLS.** Supabase documents that Row Level Security must always be enabled on tables in an exposed schema such as `public`; without policies, data is inaccessible through the API once RLS is enabled, which is safer than accidental exposure.
6. **Payment success must be server verified.** Razorpay requires server-side signature verification using `order_id + "|" + razorpay_payment_id` with HMAC SHA256 and comparison to `razorpay_signature`; only then should a payment/order be considered authentic.
7. **AI-generated or vibe-coded code often passes functional demos while failing security review.** Recent reports and papers around AI-generated code repeatedly find security issues, unreviewed code, shallow tests, technical debt, and developer overconfidence. Treat all AI-generated patches as untrusted until reviewed by tests, RLS checks, and adversarial scenarios.

### 2.2 Vibe-coded site failure modes to audit in LapKart

- UI-only role checks: admin buttons hidden but endpoints still callable.
- IDOR/BOLA: user changes `/order/[id]`, `order_id`, `return_request_id`, `shipment_id`, or `address_id` and accesses another user's data.
- Mass assignment: browser sends `status`, `payment_status`, `total`, `stock`, `role`, `verified_purchase`, `admin_note`, `refund_id`, or `provider_refund_id` and backend accepts it.
- Stale checkout: cart price, stock, coupon, or courier quote changes after the checkout page loads.
- Duplicate callbacks: payment success handler, Razorpay webhook, browser retry, and network retry all create duplicate orders or payments.
- Race conditions: two users buy the last item; coupon usage exceeds limit; admin cancels while Shiprocket webhook marks picked up.
- Mutable order snapshots: shipping phone/address, order item price/qty/title, total, coupon, and delivery promise change after order creation.
- Weak status transitions: admin jumps `pending -> delivered`, `delivered -> cancelled`, or `refunded -> shipped`.
- Provider trust bugs: Shiprocket webhook updates any order by AWB without verifying provider identity or known shipment mapping.
- Data leaks through realtime: subscribing to broad `orders`, `payments`, `shipments`, `admin_*` channels leaks other users' data.
- Storage leaks: invoices, labels, manifests, return photos, and profile images placed in public buckets without path-level policies.
- Audit gaps: admin edits are not recorded with before/after state and reason.
- No notification outbox: admin cancellation succeeds but user notification silently fails.
- No rollback plan: partial fulfillment or refund operation leaves `orders`, `shipments`, and `refunds` inconsistent.
- No negative tests: only happy path tested, so unauthorized mutations survive.

---

## 3. Non-Negotiable Security Rules

These rules must be enforced in the backend/database, not only in Svelte UI.

### 3.1 Identity and role rules

- Only authenticated users can create customer-owned records except anonymous stock notification requests and anonymous product questions if intentionally allowed.
- `user_roles` can only be read/modified through admin-only service functions.
- A normal user can never assign themselves `admin`.
- The final remaining admin must not be removable through the admin UI.
- Role checks must use a database helper such as `public.has_role(auth.uid(), 'admin')` or `public.is_admin()`.
- Admin-only Edge Functions must verify the caller's Supabase JWT and role before using service role privileges.

### 3.2 Payment rules

- Browser never sends trusted totals, trusted item prices, trusted stock, trusted shipping cost, trusted discount, or payment success state.
- `orders` and `payments` for prepaid Razorpay orders are created only after server-side signature verification.
- `checkout_sessions.amount_paise`, `subtotal`, `shipping`, `total`, `items`, `address`, `delivery_estimate`, `selected_courier`, `coupon_snapshot`, and `expires_at` are server-owned.
- A `checkout_session` can create at most one `orders` row.
- Razorpay callbacks and webhooks must be idempotent.

### 3.3 Order immutability rules

After `orders.created_at`, these must be immutable except through explicit audited service functions:

- `orders.user_id`
- `orders.payment_method`
- `orders.subtotal`
- `orders.shipping`
- `orders.discount_total`
- `orders.total`
- `orders.coupon_id`
- `orders.coupon_code`
- `orders.shipping_name`
- `orders.shipping_phone`
- `orders.shipping_email`
- `orders.shipping_address`
- all `shipping_line*`, `shipping_city`, `shipping_state`, `shipping_pincode`, `shipping_country`
- all `shipping_latitude`, `shipping_longitude`, `shipping_location_source`, `shipping_place_id`, `shipping_formatted_address`
- `orders.shipping_estimate`
- `orders.delivery_promise_snapshot`
- `order_items.title`, `image`, `brand`, `price`, `unit_price`, `qty`, `product_id`
- `payments.amount`, `provider_order_id`, `provider_payment_id`, `provider_signature`, `raw_payload`

Allowed post-creation order changes:

- `orders.status` only through legal state transition functions.
- `orders.payment_status` only through payment/refund state functions.
- `orders.tracking` only through fulfillment/tracking functions.
- `orders.updated_at` automatically.

### 3.4 Admin cancellation lock

Admin cancellation must be rejected if:

- order is already `cancelled`, `delivered`, `return_*`, `refunded`, or terminal;
- payment/refund state makes cancellation inconsistent;
- any linked shipment has reached or passed pickup/in-transit lifecycle;
- any linked shipment has `awb_code` plus a status indicating pickup scheduled, picked up, in transit, out for delivery, delivered, RTO initiated, RTO delivered, lost, damaged, or closed;
- Shiprocket provider state is unknown and a refresh is required before making a destructive decision.

Frontend must disable the cancel button for these cases, but backend must be the source of truth.

### 3.5 Notification rule

When an admin cancels an order, LapKart must atomically create:

- order status update;
- cancellation request/update if applicable;
- audit event in `admin_order_events`;
- user notification or notification outbox event;
- refund record if prepaid refund is needed;
- inventory movement if stock is released.

If immediate email/SMS/realtime delivery fails, the cancellation should not disappear. Store a retryable outbox row.

---

## 4. Recommended Status Enums and Transition Model

Current schema uses `text` for many statuses. Replace or constrain these with enums/check constraints. If full enum migration is too risky, start with `CHECK` constraints.

### 4.1 Suggested `orders.status`

Use a compact lifecycle. Avoid mixing payment, shipment, return, and refund concepts into one overloaded status.

Recommended values:

```sql
pending_payment
payment_failed
placed
confirmed
processing
packed
ready_to_ship
shipment_created
awb_assigned
pickup_scheduled
picked_up
in_transit
out_for_delivery
delivered
cancel_requested
cancelled
return_requested
return_approved
return_rejected
return_pickup_scheduled
return_in_transit
return_received
refund_pending
refunded
rto_initiated
rto_delivered
lost
damaged
closed
```

### 4.2 Suggested `orders.payment_status`

```sql
unpaid
authorized
captured
failed
cod_pending
refund_pending
partially_refunded
refunded
chargeback
```

### 4.3 Suggested `checkout_sessions.status`

```sql
created
payment_started
verified
order_created
expired
cancelled
failed
```

### 4.4 Suggested `shipments.status`

```sql
draft
create_failed
created
awb_pending
awb_assigned
pickup_scheduled
picked_up
in_transit
out_for_delivery
delivered
rto_initiated
rto_in_transit
rto_delivered
cancelled
lost
damaged
closed
```

### 4.5 Suggested `refunds.status`

```sql
requested
queued
processing
processed
failed
cancelled
```

### 4.6 State transition rules

| Entity   | From                 | To                 | Actor                 | Required checks                                          |
| -------- | -------------------- | ------------------ | --------------------- | -------------------------------------------------------- |
| order    | `pending_payment`    | `placed`           | service               | Razorpay signature verified OR valid COD eligibility     |
| order    | `placed`             | `confirmed`        | admin/service         | stock reserved, no fraud hold                            |
| order    | `confirmed`          | `processing`       | admin                 | admin role, not cancelled/refunded                       |
| order    | `processing`         | `packed`           | admin                 | items allocated, dimensions valid                        |
| order    | `packed`             | `shipment_created` | service/admin         | Shiprocket create order succeeds                         |
| shipment | `created`            | `awb_assigned`     | service/admin/webhook | AWB belongs to shipment/order                            |
| shipment | `awb_assigned`       | `pickup_scheduled` | service/admin/webhook | pickup location valid                                    |
| order    | `pickup_scheduled`   | `picked_up`        | webhook/service       | provider event verified                                  |
| order    | any pre-pickup state | `cancelled`        | admin/service         | cancellation lock passes                                 |
| order    | `delivered`          | `return_requested` | user                  | within policy window, eligible item qty                  |
| return   | `requested`          | `approved`         | admin                 | item/order eligibility, no duplicate open return         |
| return   | `return_received`    | `refund_pending`   | admin/service         | inspection passed                                        |
| refund   | `requested`          | `processed`        | service/admin         | provider refund confirmed or COD manual process recorded |

Invalid transitions must return a typed error such as `ORDER_STATUS_TRANSITION_NOT_ALLOWED`.

---

## 5. Field-Level RBAC Matrix

Legend:

- **Public:** unauthenticated visitor.
- **User:** authenticated customer.
- **Admin:** authenticated user with `admin` role.
- **Service:** backend Supabase Edge Function using service role after authenticating the caller or verifying provider webhook.

### 5.1 `profiles`

| Field        |                     Public |                          User |                                      Admin | Service | Rules                                                                   |
| ------------ | -------------------------: | ----------------------------: | -----------------------------------------: | ------: | ----------------------------------------------------------------------- |
| `id`         |                         no |                      read own |                                       read |    read | equals auth user id                                                     |
| `full_name`  |                         no | read/update own before locked |                     read/update with audit |     yes | freeze once used in a placed order unless using audited correction flow |
| `phone`      |                         no |           set once / read own | read masked; update only audited exception |     yes | identity-critical; never mass assign                                    |
| `avatar_url` | public only if intentional |                    update own |                       remove abusive image |     yes | validate storage path                                                   |
| `created_at` |                         no |                      read own |                                       read |     yes | immutable                                                               |
| `updated_at` |                         no |                          auto |                                       auto |     yes | trigger-controlled                                                      |

### 5.2 `user_roles`

| Action        | Public |                       User |           Admin | Service | Rules                                           |
| ------------- | -----: | -------------------------: | --------------: | ------: | ----------------------------------------------- |
| read own role |     no | optional via safe RPC only |             yes |     yes | do not expose whole table to users              |
| assign admin  |     no |                         no | yes, with audit |     yes | block last-admin removal; block self-escalation |
| delete role   |     no |                         no | yes, with audit |     yes | use `admin_user_events`                         |

### 5.3 `products`

| Field/action                                 | Public/User |                                  Admin | Service | Rules                                         |
| -------------------------------------------- | ----------: | -------------------------------------: | ------: | --------------------------------------------- |
| read active product fields                   |         yes |                                    yes |     yes | only `status='active'` to public              |
| read inactive/draft/archived                 |          no |                                    yes |     yes | admin only                                    |
| edit title/brand/category/description/images |          no |                                    yes |     yes | validate image URLs/storage paths             |
| edit price/mrp/gst/hsn                       |          no |                            yes + audit |     yes | never from browser checkout payload           |
| edit stock                                   |          no | preferably via inventory movement only |     yes | prevent negative stock; audit all adjustments |
| edit rating/reviews                          |          no |                 no direct manual edits | service | derive from approved reviews                  |
| delete product                               |          no |               soft-delete/archive only |     yes | hard delete blocked if referenced by orders   |

### 5.4 `addresses`

| Action | Public |                                   User |                           Admin | Service | Rules                                           |
| ------ | -----: | -------------------------------------: | ------------------------------: | ------: | ----------------------------------------------- |
| create |     no |                               own only |          no except support flow |     yes | validate phone/pincode/lat-lng                  |
| read   |     no |                               own only |             masked/support read |     yes | admin does not need broad edit by default       |
| update |     no |         own only if not order snapshot | audited support correction only |     yes | changing address must not alter existing orders |
| delete |     no | own only if not default/order-required |          no hard delete if used |     yes | prefer soft delete if later added               |

### 5.5 `checkout_sessions`

| Action |                          User |              Admin |     Service | Rules                                  |
| ------ | ----------------------------: | -----------------: | ----------: | -------------------------------------- |
| create |          via API request only |                 no |         yes | service recalculates cart/items/totals |
| read   | own active summarized session | support read maybe |         yes | no sensitive provider secrets          |
| update |              no direct update |   no direct update |         yes | status transitions only                |
| delete |                            no |                 no | cleanup job | expired sessions only                  |

### 5.6 `orders`

| Field/action           |                      User |                                       Admin |                                        Service | Rules                                              |
| ---------------------- | ------------------------: | ------------------------------------------: | ---------------------------------------------: | -------------------------------------------------- |
| create                 |          no direct insert |                            no direct insert |                                            yes | after payment verification or COD validation       |
| read                   |                  own only |                                         all |                                            yes | user cannot read another user's order              |
| update status          | cancellation request only |                       legal transition only |                                            yes | use transition function                            |
| cancel                 |       request before lock |            approve/admin-cancel before lock |                                            yes | never after shipped/picked up/in transit/delivered |
| edit totals            |                        no |                                          no | only controlled correction before finalization | should be immutable                                |
| edit shipping snapshot |        no after placement | no except audited exception before shipment |                                            yes | never after shipped                                |
| read risk_score        |                        no |                                         yes |                                            yes | hide from user                                     |
| tracking               |         own tracking only |                                        full |                                            yes | hide internal raw provider data                    |

### 5.7 `order_items`

| Action |           User | Admin |                                           Service | Rules                            |
| ------ | -------------: | ----: | ------------------------------------------------: | -------------------------------- |
| read   | own order only |   all |                                               yes | product snapshot allowed         |
| insert |             no |    no |                                               yes | copied from products at checkout |
| update |             no |    no | controlled service only before order finalization | immutable after order creation   |
| delete |             no |    no |           no except rollback before order visible | keep audit trail                 |

### 5.8 `payments`

| Action/field       |                                      User |                    Admin | Service | Rules                                              |
| ------------------ | ----------------------------------------: | -----------------------: | ------: | -------------------------------------------------- |
| read summary       | own order only; no signatures/raw payload |               yes masked |     yes | hide `provider_signature`, `raw_payload` from user |
| insert/update      |                                        no | no direct manual success |     yes | after Razorpay verification/webhook                |
| provider_signature |                                        no |                 no in UI |     yes | sensitive                                          |
| raw_payload        |                                        no | admin debug maybe masked |     yes | may contain PII/provider data                      |

### 5.9 Fulfillment tables

Applies to `shipping_pickup_locations`, `shipments`, `shipment_packages`, `shipment_events`, `shipping_batches`, `shipping_batch_items`.

| Action                      |                           User |                     Admin | Service | Rules                                     |
| --------------------------- | -----------------------------: | ------------------------: | ------: | ----------------------------------------- |
| read own tracking           | limited shipment event summary |                       yes |     yes | user sees public tracking only            |
| create shipment             |                             no |              via API only |     yes | require valid order status and dimensions |
| assign AWB                  |                             no |              via API only |     yes | idempotent and audited                    |
| schedule pickup             |                             no |              via API only |     yes | pickup location active/default            |
| cancel shipment             |                             no | before provider lock only |     yes | disallow after pickup                     |
| raw payloads                |                             no |         masked/debug only |     yes | never public/realtime                     |
| label/invoice/manifest URLs |              own invoice maybe |                       yes |     yes | storage should be private/signed          |

### 5.10 Cancellation, return, and refund tables

| Table                         | User can                                                  | Admin can                              | User cannot                                | Admin cannot                                   |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `order_cancellation_requests` | create for own cancellable order; read own                | approve/reject with reason before lock | cancel others' orders; force refund status | approve after shipment lock; delete evidence   |
| `return_requests`             | create own eligible delivered order return; upload photos | approve/reject/receive/inspect         | return ineligible/expired qty              | approve beyond policy without exception event  |
| `return_request_items`        | create items within owned order qty                       | inspect/read                           | exceed purchased qty                       | change qty without audit                       |
| `refunds`                     | read own refund summary                                   | initiate/monitor through service       | set refund status/provider ID              | mark refunded without provider/manual evidence |

### 5.11 Engagement and merchandising tables

| Table                       | User can                                           | Admin can                          | Must block                                             |
| --------------------------- | -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `wishlist_items`            | manage own product wishlist                        | read aggregate maybe               | duplicate rows, other user's wishlist                  |
| `product_reviews`           | review purchased products, edit own pending review | moderate, approve/reject, add note | fake verified_purchase, review unrelated product/order |
| `product_questions`         | ask question; read approved Q&A                    | answer/moderate                    | XSS, spam, pretending admin answer                     |
| `stock_notifications`       | create own/email notification                      | review/process                     | email enumeration, duplicate spam                      |
| `stock_notification_events` | no direct access                                   | admin/service                      | user reading all emails                                |
| `coupons`                   | read active eligible coupons only                  | manage coupons                     | users creating/updating coupons                        |
| `coupon_redemptions`        | read own usage maybe                               | read all                           | duplicate redemption, usage-limit race                 |
| `business_accounts`         | create/update own non-verified fields              | verify/reject/admin note           | user setting `verification_status` or `pro_tier`       |
| `order_invoices`            | read/download own invoice                          | generate/regenerate                | user changing invoice number/status                    |

### 5.12 Audit tables

`admin_order_events` and `admin_user_events` are append-only.

- User: no direct read unless a sanitized activity feed is intentionally created.
- Admin: read allowed; insert only through service functions.
- Service: insert with `from_state`, `to_state`, `metadata`, `reason`, `admin_user_id`.
- Updates/deletes: blocked except database owner maintenance.

---

## 6. Database Implementation Tasks

### 6.1 Add helper role functions

Create SQL helper functions and use them in policies and RPC functions.

```sql
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin'::app_role);
$$;
```

Review `app_role` enum values before applying. If `app_role` values differ, adapt.

### 6.2 Enable RLS on all exposed public tables

```sql
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.order_cancellation_requests enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;
alter table public.refunds enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.product_reviews enable row level security;
alter table public.stock_notifications enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.order_invoices enable row level security;
alter table public.business_accounts enable row level security;
alter table public.product_questions enable row level security;
alter table public.stock_notification_events enable row level security;
alter table public.admin_order_events enable row level security;
alter table public.admin_user_events enable row level security;
```

Also enable RLS on fulfillment tables and restrict to admin/service:

```sql
alter table public.shipping_pickup_locations enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_packages enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipping_batches enable row level security;
alter table public.shipping_batch_items enable row level security;
```

### 6.3 Add notification outbox

Current schema has no generic notification table. Add one.

```sql
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  event_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{{}}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','dead_letter')),
  attempts int not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_outbox enable row level security;
```

Policies:

- Users can read their own in-app notifications.
- Users cannot insert/update/delete notification rows.
- Admin can read notification status for support.
- Service functions insert/update delivery status.

### 6.4 Add provider webhook idempotency table

```sql
create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('razorpay','shiprocket','ola_maps')),
  provider_event_id text,
  event_type text not null,
  signature_valid boolean not null default false,
  idempotency_key text not null,
  related_order_id uuid references public.orders(id) on delete set null,
  related_shipment_id uuid references public.shipments(id) on delete set null,
  payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, idempotency_key)
);

alter table public.provider_webhook_events enable row level security;
```

### 6.5 Add inventory movement table

Current `products.stock` alone is not enough to audit or reverse inventory changes.

```sql
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  movement_type text not null check (movement_type in (
    'admin_adjustment',
    'reservation',
    'reservation_release',
    'sale_commit',
    'cancel_release',
    'return_received',
    'damage_writeoff'
  )),
  qty_delta int not null,
  reason text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{{}}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.inventory_movements enable row level security;
```

Rules:

- `products.stock` must never become negative.
- Use row locks during checkout: `select ... from products where id = ... for update`.
- Never trust `qty` or `price` from browser. Re-read products in the transaction.

### 6.6 Add immutable triggers for order snapshots

Implement a trigger that rejects direct updates to immutable fields after order creation.

```sql
create or replace function public.prevent_order_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id is distinct from new.user_id then raise exception 'ORDER_USER_IMMUTABLE'; end if;
  if old.subtotal is distinct from new.subtotal then raise exception 'ORDER_SUBTOTAL_IMMUTABLE'; end if;
  if old.shipping is distinct from new.shipping then raise exception 'ORDER_SHIPPING_IMMUTABLE'; end if;
  if old.discount_total is distinct from new.discount_total then raise exception 'ORDER_DISCOUNT_IMMUTABLE'; end if;
  if old.total is distinct from new.total then raise exception 'ORDER_TOTAL_IMMUTABLE'; end if;
  if old.payment_method is distinct from new.payment_method then raise exception 'ORDER_PAYMENT_METHOD_IMMUTABLE'; end if;
  if old.coupon_id is distinct from new.coupon_id then raise exception 'ORDER_COUPON_IMMUTABLE'; end if;
  if old.coupon_code is distinct from new.coupon_code then raise exception 'ORDER_COUPON_CODE_IMMUTABLE'; end if;
  if old.shipping_name is distinct from new.shipping_name then raise exception 'ORDER_SHIPPING_NAME_IMMUTABLE'; end if;
  if old.shipping_phone is distinct from new.shipping_phone then raise exception 'ORDER_SHIPPING_PHONE_IMMUTABLE'; end if;
  if old.shipping_address is distinct from new.shipping_address then raise exception 'ORDER_SHIPPING_ADDRESS_IMMUTABLE'; end if;
  if old.shipping_line1 is distinct from new.shipping_line1 then raise exception 'ORDER_SHIPPING_LINE1_IMMUTABLE'; end if;
  if old.shipping_line2 is distinct from new.shipping_line2 then raise exception 'ORDER_SHIPPING_LINE2_IMMUTABLE'; end if;
  if old.shipping_city is distinct from new.shipping_city then raise exception 'ORDER_SHIPPING_CITY_IMMUTABLE'; end if;
  if old.shipping_state is distinct from new.shipping_state then raise exception 'ORDER_SHIPPING_STATE_IMMUTABLE'; end if;
  if old.shipping_pincode is distinct from new.shipping_pincode then raise exception 'ORDER_SHIPPING_PINCODE_IMMUTABLE'; end if;
  if old.shipping_country is distinct from new.shipping_country then raise exception 'ORDER_SHIPPING_COUNTRY_IMMUTABLE'; end if;
  if old.shipping_estimate is distinct from new.shipping_estimate then raise exception 'ORDER_SHIPPING_ESTIMATE_IMMUTABLE'; end if;
  if old.delivery_promise_snapshot is distinct from new.delivery_promise_snapshot then raise exception 'ORDER_DELIVERY_PROMISE_IMMUTABLE'; end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_order_snapshot_mutation on public.orders;
create trigger trg_prevent_order_snapshot_mutation
before update on public.orders
for each row execute function public.prevent_order_snapshot_mutation();
```

Implement equivalent protection for `order_items` and `payments`.

### 6.7 Add legal transition function

Use a service function/RPC for status changes instead of direct table updates.

Pseudo-logic:

```sql
-- public.transition_order_status(order_id, next_status, reason, metadata)
-- 1. Verify caller is admin/service.
-- 2. Lock order row FOR UPDATE.
-- 3. Load linked shipments FOR UPDATE.
-- 4. Check current status + next status against transition matrix.
-- 5. If next_status='cancelled', call cancellation lock validator.
-- 6. Update order.status only.
-- 7. Insert admin_order_events with from_state/to_state.
-- 8. Insert notification_outbox when user-facing.
```

---

## 7. Backend API/Edge Function Hardening Tasks

Search `supabase/functions/api` and any SvelteKit server endpoints for these patterns.

### 7.1 Reject mass assignment

For every request body, use allowlists.

Bad:

```ts
await supabase.from('orders').update(body).eq('id', body.id);
```

Good:

```ts
const input = parseAndValidateAdminOrderAction(body);
await adminCancelOrder({ orderId: input.orderId, reason: input.reason });
```

Explicitly reject or ignore fields such as:

- `user_id`
- `role`
- `status`
- `payment_status`
- `payment_method`
- `subtotal`
- `shipping`
- `discount_total`
- `total`
- `risk_score`
- `verified_purchase`
- `provider_*`
- `raw_payload`
- `admin_note` unless endpoint is admin-only
- `refund_id`
- `reverse_shipment_id`
- `shiprocket_*`

### 7.2 User-owned object checks

Every user endpoint accepting an ID must verify ownership server-side.

Required checks:

- `orders.id` belongs to `auth.uid()` before returning details.
- `addresses.id` belongs to `auth.uid()` before use at checkout.
- `wishlist_items.product_id` operations are scoped to `auth.uid()`.
- `return_requests.id` belongs to `auth.uid()` for user views.
- `order_cancellation_requests.id` belongs to `auth.uid()` for user views.
- `product_reviews.order_id` belongs to `auth.uid()` and contains reviewed product.
- `business_accounts.user_id = auth.uid()` for user updates.

### 7.3 Admin endpoint checks

Every admin endpoint must:

1. Parse JWT.
2. Verify session user.
3. Verify admin role via database/RPC, not client state.
4. Use service role only after authorization.
5. Record `admin_user_id`, reason, before/after state for changes.
6. Return typed errors.

### 7.4 Checkout transaction rules

The checkout function must run as one transaction where possible:

1. Authenticate user.
2. Load product rows with row locks.
3. Check `products.status='active'`.
4. Check stock availability.
5. Recalculate item prices, GST, subtotal, discount, shipping, total.
6. Validate coupon active, date window, minimum subtotal, total usage, per-user usage.
7. Validate selected courier still available.
8. Validate COD only if all items/order/address are eligible.
9. Create/update `checkout_sessions`.
10. For Razorpay, create Razorpay order server-side and store `razorpay_order_id`.
11. Expire old sessions.

### 7.5 Razorpay verification rules

When payment success returns from checkout:

1. Look up `checkout_sessions.razorpay_order_id`.
2. Check session not expired and not already used.
3. Verify HMAC signature server-side.
4. Verify amount/currency with stored session and/or Razorpay payment status.
5. Use idempotency key from `razorpay_order_id` + `razorpay_payment_id`.
6. Create exactly one `orders` row.
7. Create exactly one `payments` row.
8. Create `order_items` from session/server snapshot.
9. Decrement/commit stock via inventory movement.
10. Mark session `order_created` and set `order_id`.

### 7.6 Shiprocket rules

- Create Shiprocket orders only for valid paid/COD orders in allowed statuses.
- Validate product dimensions/weight before creation.
- Use idempotency: one active forward shipment per order unless explicitly split shipment is implemented.
- Store provider IDs in `shipments`.
- Never expose raw provider payloads to users.
- Verify webhooks where provider supports signatures/secrets.
- Process webhook events idempotently and tolerate out-of-order events.
- Map provider statuses to internal statuses through a single mapping function.
- Do not allow cancellation after provider pickup states.

### 7.7 Ola Maps rules

- Treat address search/reverse geocoding as suggestions, not proof of delivery address.
- Validate pincode/state/country server-side.
- Check lat/lng ranges.
- Prevent client from injecting arbitrary delivery distance/cost.
- Store route estimate snapshot at checkout/order time.
- Do not recalculate old orders in a way that changes committed delivery promise.

---

## 8. Frontend UI Gating Tasks

Frontend gating is required for UX but never enough for security.

### 8.1 User UI

- Hide or disable cancellation button when order is shipped/picked up/in transit/out for delivery/delivered/cancelled/refunded.
- Return button appears only after delivered and inside policy window.
- Disable review form unless product was purchased and delivered.
- Disable COD if cart/order/address/product not eligible.
- Show checkout session expiration and force refresh if stale.
- Show immutable warning for shipping phone/address after placing order.
- Show support correction request flow instead of direct edit.

### 8.2 Admin UI

- Admin panel must fetch permissions/status locks from backend, not recompute everything only in Svelte.
- Disable cancel action with reason: `Shipment already picked up`, `Delivered order`, `Refund already processed`, etc.
- Require reason for cancellation, refund, stock adjustment, role change, and address correction.
- Show before/after diff for destructive actions.
- Bulk actions must preview eligible/ineligible rows before execution.
- Admin should see masked payment signatures/raw payloads unless in secure debug mode.
- Role management must block self-escalation/self-demotion danger and last-admin removal.

---

## 9. Common Edge Cases Checklist

Use this as a test plan. Every item should have either a unit test, integration test, database test, or manual admin QA scenario.

### 9.1 Authentication and sessions

- Expired JWT attempts to access checkout/order/admin.
- Anonymous user accesses `/orders`, `/dashboard`, `/admin`.
- User logs out in one tab while checkout is open in another.
- User tries to access another user's order by changing URL.
- User tries to access another user's address ID during checkout.
- User deleted from auth but profile/order rows remain.
- Same user has duplicate role rows.
- Admin role revoked while admin panel tab is open.
- Last admin attempts to remove own admin role.
- Admin tries to grant admin without reason/audit.

### 9.2 Product/catalog

- Negative price or MRP lower than price.
- Negative stock.
- Duplicate SKU case-insensitive.
- Product set inactive while in cart.
- Product price changes after cart loaded.
- Product stock changes after cart loaded.
- Product dimensions missing but Shiprocket shipping is selected.
- Product `cod_eligible=false` but user chooses COD.
- Product image path points to external unsafe URL or private bucket incorrectly.
- Admin hard-deletes product used by order item.
- Rating/review count manually tampered.

### 9.3 Cart and checkout

- Cart contains qty 0, negative qty, huge qty, decimal qty.
- Browser sends manipulated unit price.
- Browser sends manipulated shipping charge.
- Browser sends manipulated discount amount.
- Checkout session expires before payment success callback.
- User opens two checkout sessions for same cart.
- User pays both sessions.
- User double-clicks pay/place order.
- Network retry repeats session creation.
- Courier option selected but no longer serviceable at payment time.
- Address pincode and lat/lng conflict.
- Address country not India but local courier/COD selected.
- COD selected for high risk score/large order/ineligible pincode.
- Coupon applied before login then checkout after login.

### 9.4 Coupons

- Coupon code case mismatch.
- Coupon starts in future.
- Coupon expired during checkout.
- Coupon usage limit reached by concurrent orders.
- Per-user limit reached by previous order.
- Coupon minimum subtotal no longer met after stock/price change.
- Max discount exceeded.
- Coupon redemption created but order payment fails.
- Cancelled order should release coupon usage only if business rules allow it.
- Admin deactivates coupon while checkout session exists.

### 9.5 Payments

- Razorpay signature missing.
- Razorpay signature invalid.
- Razorpay order ID not found in `checkout_sessions`.
- Razorpay amount does not match session amount.
- Currency mismatch.
- Payment authorized but not captured.
- Payment failed after checkout session created.
- Payment success callback repeated.
- Razorpay webhook arrives before browser callback.
- Browser callback arrives before webhook.
- Webhook repeated.
- Refund webhook repeated.
- User closes browser after payment success but before frontend route updates.
- Payment row exists but order creation failed halfway.
- COD order mistakenly gets prepaid payment status.

### 9.6 Orders

- User requests cancellation for another user's order.
- User cancels after shipment created but before pickup; ensure business rule is explicit.
- Admin cancels after AWB assigned but before pickup; ensure provider cancellation is attempted if required.
- Admin cancels after pickup; must be blocked.
- Admin cancels delivered order; must be blocked.
- Admin updates `total` after payment; must be blocked.
- Admin edits `shipping_phone` after order placed; must be blocked or audited exception before shipment.
- Status jump `placed -> delivered`; must be blocked.
- Status regression `delivered -> processing`; must be blocked.
- Duplicate cancellation requests.
- Cancellation request resolved twice.
- Cancellation approved but refund creation fails.
- Cancellation approved but notification fails.
- Cancellation approved but stock release fails.
- Partial order cancellation not implemented but UI allows it.
- Order has multiple shipments but cancellation checks only first shipment.

### 9.7 Fulfillment and Shiprocket

- Order has no dimensions/weight.
- Pickup location inactive.
- No default pickup location.
- Shiprocket create order succeeds but local DB update fails.
- Local shipment created but Shiprocket create fails.
- AWB assignment repeated.
- AWB assigned to wrong order.
- Shipment webhook refers to unknown AWB.
- Webhook status older than current status.
- Delivered webhook arrives after RTO webhook.
- Pickup scheduled date in past.
- Label URL public and guessable.
- Manifest generated for wrong batch.
- Bulk label generation has partial failures.
- Shipping charge from provider differs from estimate.
- COD amount mismatch.
- Reverse shipment accidentally linked to forward shipment.
- Return shipment updates forward order incorrectly.

### 9.8 Returns

- Return requested before delivery.
- Return requested after DOA/return window.
- Product has `doa_policy_days=0` but return button appears.
- User requests return qty greater than purchased qty.
- User submits return for item not in order.
- Duplicate open return for same order item.
- Photos array empty when required.
- Photo upload contains unsupported type or huge file.
- Admin approves return without selecting items.
- Admin marks return received before reverse shipment delivered.
- Admin refunds before inspection when policy says not to.
- Return rejected but refund still created.
- Partial refund amount exceeds item value.
- Return for COD order requires manual refund method.

### 9.9 Refunds

- Refund amount greater than captured amount minus previous refunds.
- Duplicate refund for same cancellation/return.
- Refund provider succeeds but DB update fails.
- DB marks processed but provider failed.
- Partial refund and full refund both attempted.
- Refund initiated by non-admin.
- Admin edits `provider_refund_id` manually.
- Refund status changes without audit event.
- Refund for unpaid/COD order incorrectly sent to Razorpay.

### 9.10 Reviews and questions

- User reviews product not purchased.
- User reviews before order delivered.
- User reviews same item multiple times if one review only is intended.
- User sets `verified_purchase=true` in payload.
- User posts script tags in review body/question.
- Admin answer contains unsafe HTML.
- Anonymous product question spam.
- Moderation status bypassed by direct API call.

### 9.11 Stock notifications

- Anonymous email spam.
- Duplicate notification for same email/product.
- Email enumeration through status messages.
- Notification sent repeatedly after restock.
- Notification event says processed but email failed.
- User deletes account but notification still contains PII.

### 9.12 Business accounts

- User sets own `verification_status='verified'`.
- User sets `pro_tier`.
- Admin verifies without GSTIN validation if required.
- GSTIN format invalid.
- Billing email/phone changed after invoice generated.
- Business account deleted while orders/invoices depend on it.

### 9.13 Realtime and storage

- Realtime subscription receives all `orders` rows.
- Realtime subscription receives all `payments` rows.
- Admin audit events broadcast to users.
- Return photos visible publicly.
- Invoice/label/manifest accessible without signed URL.
- User uploads file outside own path prefix.
- User overwrites another user's avatar/return photo.
- Product images in public bucket but admin uploads private images accidentally.

### 9.14 Admin operations

- Admin bulk cancels mix of eligible and ineligible orders.
- Bulk operation partially succeeds but UI shows all success.
- Admin closes tab during bulk job.
- Admin edits role and order in two tabs causing stale state.
- Admin performs action without reason.
- Audit event insert fails but mutation succeeds.
- Admin sees full payment raw payload unnecessarily.
- Admin deletes audit logs.

### 9.15 Database and migrations

- RLS enabled without policies, breaking app unexpectedly.
- Policy allows `auth.uid() = user_id` but unauthenticated `auth.uid()` null behavior is misunderstood.
- Security definer function missing `set search_path`.
- Service role key leaks to frontend bundle.
- Migration adds enum but app still sends old text value.
- Trigger blocks legitimate controlled transition because function updates immutable field.
- Missing indexes make RLS policies slow.

---

## 10. Codex Prompt Pack

Use these prompts one at a time. After each prompt, inspect the diff and run checks.

### Prompt 1 — Repo inventory and risk map

```text
Read this repository and produce a concise implementation inventory for LapKart security/RBAC hardening. Do not modify files yet.

Inspect:
- AGENTS.md
- MIGRATION_STATUS.md
- package.json
- src/routes
- src/lib
- supabase/functions/api
- supabase/migrations

Return:
1. All endpoints/routes that read or mutate orders, payments, checkout sessions, products, profiles, addresses, shipments, returns, refunds, coupons, roles, reviews, questions, and notifications.
2. Any direct Supabase table writes from browser/client code.
3. Any admin-only actions currently protected only by frontend UI.
4. Current status strings used in code.
5. Existing RLS policies/migrations and gaps.
6. Suggested safe implementation order.

Do not edit code in this pass.
```

### Prompt 2 — Database constraints and enums/checks

```text
Implement a Supabase migration that adds strict status validation and safety constraints without breaking existing data.

Tasks:
1. Inventory current distinct status values in the code/migrations/seed data before choosing constraints.
2. Add CHECK constraints or enums for orders.status, orders.payment_status, checkout_sessions.status, shipments.status, refunds.status, return_requests.status, order_cancellation_requests.status, product_reviews.status, products.status, coupons active/date validity where possible.
3. Add non-negative checks for product price/mrp/stock/dimensions, order totals, payment/refund amounts, coupon discounts, and quantities.
4. Add immutable triggers for order snapshots, order_items, payments, and audit tables.
5. Add comments explaining each constraint.
6. Include a rollback section if the project convention supports it.
7. Run npm run check.

Do not change frontend UI yet.
```

### Prompt 3 — RLS policies

```text
Implement or repair Supabase RLS policies for all public tables in LapKart.

Requirements:
- Enable RLS on all public tables.
- Add helper functions public.has_role(user_id, role) and public.is_admin() with SECURITY DEFINER and safe search_path.
- Public users can read only active products and approved public Q&A/reviews.
- Authenticated users can read/write only their own profile/address/wishlist/order views according to the RBAC spec.
- Users cannot insert/update orders, payments, order_items, shipments, refunds, admin events, or role rows directly.
- Admins can read operational data but destructive mutations must go through RPC/Edge Functions where possible.
- Audit tables are append-only by service functions.
- Payments raw payload/signature fields should not be exposed to users. Use views/RPC if table-level RLS cannot protect columns.
- Add indexes needed for policies, especially user_id, order_id, product_id, shipment_id.
- Add negative tests or SQL comments showing expected blocked access.

Run npm run check after changes.
```

### Prompt 4 — Checkout and payment hardening

```text
Harden the checkout and Razorpay flow.

Requirements:
1. Ensure browser never controls trusted price, total, discount, shipping, payment_status, order status, or stock.
2. Recalculate cart from products in the backend/service function.
3. Lock product rows or otherwise prevent overselling.
4. Validate coupon usage and per-user limits transactionally.
5. Validate courier/serviceability after address selection and before payment/order creation.
6. Create checkout_sessions server-side and expire sessions.
7. Verify Razorpay signature server-side using the stored checkout session.
8. Make payment callback/webhook idempotent.
9. Create exactly one order per successful checkout session.
10. Insert payment/order/order_items/inventory movement in one safe transaction or with compensating recovery.
11. Add tests for duplicate callback, invalid signature, stale session, changed price, insufficient stock, expired coupon, and amount mismatch.

Do not implement UI-only fixes without backend enforcement.
```

### Prompt 5 — Order status transition service

```text
Implement a backend-only order transition service/RPC for admin and service workflows.

Requirements:
- No direct arbitrary updates to orders.status from UI payloads.
- Define allowed transitions for order, payment, shipment, cancellation, return, and refund states.
- Lock the order row and related shipment rows during transition.
- Block admin cancellation after shipped/picked_up/in_transit/out_for_delivery/delivered/RTO/terminal shipment states.
- Require reason for admin cancellation, refund, return rejection, manual correction, and role changes.
- Insert admin_order_events with from_state, to_state, metadata, reason, admin_user_id.
- Insert notification_outbox row for user-facing events, especially admin cancellation.
- Return typed errors for UI display.
- Add tests for all invalid transitions.

Run npm run check.
```

### Prompt 6 — Fulfillment and Shiprocket hardening

```text
Audit and harden Shiprocket fulfillment code.

Requirements:
1. Identify all Shiprocket create order, assign AWB, schedule pickup, cancel shipment, label, manifest, invoice, tracking, and webhook paths.
2. Ensure only admins/service functions can initiate provider actions.
3. Add idempotency so repeated clicks/webhooks do not duplicate shipments/AWBs/batches.
4. Validate pickup location active/default.
5. Validate product/package dimensions and weights.
6. Store provider IDs and raw payloads securely.
7. Do not expose raw payloads, internal errors, or signed documents to users.
8. Map provider statuses to internal statuses in one function.
9. Reject out-of-order webhook regressions unless explicitly allowed.
10. Make shipment state affect order cancellation locks.
11. Add tests for duplicate AWB, unknown AWB webhook, stale webhook, cancelled shipment, and bulk partial failures.
```

### Prompt 7 — Returns, refunds, and cancellation requests

```text
Implement strict cancellation, return, and refund workflows.

Requirements:
- User can request cancellation only for own order and only before cancellation lock.
- Admin can approve/reject cancellation only before shipment lock.
- Admin cancellation creates user notification/outbox atomically.
- Prepaid cancellation creates refund workflow; COD cancellation does not call Razorpay refund.
- Return request allowed only for delivered own orders inside policy window and eligible item quantities.
- Return photos must be validated and stored in private/user-scoped storage paths.
- Refund amount cannot exceed captured amount minus previous refunds.
- Refund status must follow legal transitions and provider evidence.
- All admin decisions require reason and audit events.
- Add tests for duplicate requests, expired return window, excess qty, duplicate refunds, and provider failure.
```

### Prompt 8 — Frontend UI gating after backend enforcement

```text
Now update Svelte/SvelteKit UI gating to reflect backend permissions.

Requirements:
- Fetch action availability from backend where possible.
- Disable/hide user/admin actions that backend will reject.
- Show typed backend errors clearly.
- Add loading and idempotency guards for buttons.
- Admin cancellation button must be disabled after shipment lock and show reason.
- User cancellation button must be disabled after shipment lock.
- Return button must show only after delivered and inside policy window.
- Admin role and destructive actions must require confirmation + reason.
- Do not rely on frontend gating as the only control.

Run npm run check.
```

### Prompt 9 — Security test suite

```text
Create a security regression test suite for LapKart.

Include tests for:
- User cannot read another user's orders, addresses, payments, returns, refunds, wishlist, business account.
- User cannot update admin-only fields through mass assignment.
- User cannot create order/payment/order_items directly.
- User cannot set verified_purchase, role, status, refund status, provider IDs, raw payloads.
- Admin cannot cancel shipped/picked up/in transit/delivered orders.
- Admin cannot mutate immutable order snapshots.
- Razorpay invalid signature fails.
- Duplicate payment callback is idempotent.
- Coupon limits are concurrency-safe.
- Stock cannot go negative under concurrent checkout.
- Shiprocket webhook is idempotent and cannot regress status.
- Notification outbox row is created for admin cancellation.

Use the project's existing test framework. If no framework exists, add the smallest practical setup and document how to run it.
```

---

## 11. Definition of Done

This hardening is complete only when all of the following are true:

- RLS is enabled on every exposed public table.
- Normal users cannot directly insert/update/delete server-owned rows.
- Admin actions are verified server-side, not only in UI.
- `orders`, `order_items`, and `payments` snapshots are immutable.
- Status fields have explicit allowed values.
- Illegal state transitions are rejected by backend/database.
- Admin cancellation after shipment lock is impossible through UI, API, SQL policy, and service function path.
- Admin cancellation creates an audit event and notification outbox event.
- Razorpay payment order creation is idempotent and signature-verified.
- Shiprocket webhooks and admin fulfillment actions are idempotent.
- Stock/coupon races are covered by row locks or equivalent transactional logic.
- Sensitive payloads/signatures/raw provider data are not visible to users.
- Private documents/photos are protected by storage policies or signed URLs.
- Negative tests exist for all high-risk edge cases.
- `npm run check` passes.

---

## 12. Source Notes for Research Context

Use these as background while implementing, not as a substitute for repo inspection.

- OWASP API Security Top 10 2023: Broken Object Level Authorization, Broken Object Property Level Authorization, Broken Function Level Authorization, Unsafe Consumption of APIs.
- OWASP Top 10 2021: Broken Access Control is a top web application risk.
- Supabase docs: RLS must be enabled on exposed schemas and policies act like implicit query filters.
- Razorpay docs: successful checkout fields must be verified server-side using `razorpay_signature` before trusting payment success.
- Recent AI/vibe-coding security research and reporting consistently warns that AI-generated code can be functional yet insecure, especially around auth, edge cases, and unreviewed production code.

---

## 13. High-Priority Implementation Order

1. Repo inventory and status value inventory.
2. Add role helper functions.
3. Enable RLS and add minimal safe policies.
4. Add immutable triggers.
5. Add notification outbox.
6. Add provider webhook idempotency table.
7. Add inventory movements and stock-safe checkout.
8. Harden Razorpay verification and idempotency.
9. Harden order transition/cancellation service.
10. Harden Shiprocket workflows.
11. Harden returns/refunds.
12. Update frontend gating.
13. Add security regression tests.
14. Run full validation and document any intentionally deferred decisions.

---

## 14. Decisions to Confirm in Code or Business Policy

Codex should not invent these silently. If no existing policy exists, implement conservative defaults and leave TODO comments.

- Is COD allowed for all users or only low-risk/serviceable orders?
- Can admin cancel after AWB assignment but before pickup?
- Can user cancel after shipment created but before pickup?
- Is partial cancellation supported?
- Is partial return/refund supported?
- Are return windows per product from `products.doa_policy_days` only, or are there category-level overrides?
- Are business account GST details immutable after invoice generation?
- Are invoices generated at payment capture, shipment, or delivery?
- Should coupon usage be released after cancellation/refund?
- Is admin allowed to correct shipping address before shipment creation?
- Should phone number be globally immutable after profile creation or only immutable once used in an order?

Default conservative answer unless business policy says otherwise:

- Do not allow partial cancellation.
- Do not allow cancellation after AWB pickup/shipment movement.
- Do not allow mutable identity/order/payment fields after placement.
- Require audited exception flows for support corrections.

---

## 15. Quick Grep Checklist for Codex

Search for these patterns:

```bash
rg "from\('orders'\).*update|update\(.*status|payment_status|refund_id|verified_purchase|user_roles|service_role|SUPABASE_SERVICE|raw_payload|provider_signature|shiprocket|razorpay_signature|checkout_sessions|order_cancellation_requests|return_requests|refunds" .
```

Also search for direct client writes:

```bash
rg "supabase\.from\('(?:orders|payments|order_items|shipments|refunds|user_roles|admin_order_events|admin_user_events)'\)" src
```

Search status literals:

```bash
rg "pending|placed|confirmed|processing|shipped|delivered|cancelled|refunded|return|pickup|awb|captured|failed" src supabase api
```

---

## 16. Final Warning to the Agent

The target is not merely to make the UI look correct. The target is to make unsafe states **unrepresentable or rejected**.

A correct implementation must still be safe when:

- a malicious user calls the API directly;
- a browser tab has stale UI state;
- two requests happen concurrently;
- Razorpay or Shiprocket retries a webhook;
- an admin double-clicks a destructive action;
- a provider sends events out of order;
- a previous AI-generated patch forgot a hidden route.

If a rule matters financially, legally, or operationally, enforce it in the database/service layer and test the negative path.
