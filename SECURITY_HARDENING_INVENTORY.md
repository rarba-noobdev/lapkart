LapKart Security Hardening Inventory

Date: 2026-06-06

Scope: RBAC, order/payment/fulfillment lifecycle hardening, provider idempotency, immutable commerce snapshots, and backend-first UI gating.

## 1. Routes and Endpoints

### SvelteKit routes

- Storefront/catalog: `src/routes/+page.*`, `src/routes/products/+page.*`, `src/routes/product/[id]/+page.*`
- Cart/checkout: `src/routes/cart/+page.svelte`, `src/routes/checkout/+page.server.ts`, `src/routes/checkout/+page.svelte`
- Orders: `src/routes/orders/+page.*`, `src/routes/order/[id]/+page.*`
- Account/auth: `src/routes/login/+page.*`, `src/routes/dashboard/+page.*`, `src/routes/auth/callback/+server.ts`, `src/routes/auth/signout/+server.ts`
- Admin: `src/routes/admin/+page.*`, `src/routes/admin/fulfillment/+page.*`
- Static policy/support: `src/routes/about`, `contact`, `privacy`, `terms`, `shipping-policy`, `returns-policy`, `cancellation-refunds`

### Supabase Edge Function API

Canonical implementation: `supabase/functions/api/index.ts`

- Health/risk: `GET /health`, `POST /fraud/score`
- Checkout/payment: `POST /checkout/preview`, `POST /checkout/create-cod-order`, `POST /checkout/create-payment-order`, `POST /checkout/complete-payment`, legacy Razorpay aliases
- Maps: `GET /maps/autocomplete`, `GET /maps/reverse-geocode`, `GET /maps/delivery-estimate`
- Shiprocket/account: `GET /shiprocket/status`, `GET /shiprocket/account`
- Fulfillment: `GET /admin/fulfillment/orders`, `POST /shipments/shiprocket/create`, `POST /shipments/shiprocket/assign-awb`, `POST /shipments/shiprocket/pickup`, `GET /shipments/shiprocket/:shipmentId/tracking`, `POST /shipments/shiprocket/return`, `POST /shipments/shiprocket/bulk`, `POST /shipments/shiprocket/labels`
- Webhooks/provider events: `POST /logistics/events`
- User order lifecycle: `GET /orders/:orderId/tracking`, `GET /orders/:orderId/invoice`, `POST /orders/:orderId/cancel`, `POST /orders/:orderId/return`
- Engagement/account: `GET/POST/DELETE /wishlist`, `POST /product-reviews`, `POST /stock-notifications`, `GET/PATCH /account/business`, `GET/POST /product-questions`
- Admin moderation/support: `GET/PATCH /admin/product-questions`, `GET/PATCH/POST /admin/stock-notification-events`
- Admin cancellation/returns/refunds: `POST /admin/cancellations/:id`, `POST /admin/returns/:id`, `POST /admin/refunds`
- Admin CRUD/RBAC: `GET/POST/PATCH/DELETE /admin/products`, `GET/POST/PATCH/DELETE /admin/coupons`, `GET/PATCH /admin/users`, `GET/PATCH /admin/orders`, `GET /admin/analytics`
- Storage uploads: `POST /storage/:bucket/...`

Parallel local API mirror: `api/src/server.ts`. It has the same high-risk patterns and should be kept aligned when Edge Function behavior changes.

## 2. Direct Browser Writes

High-risk grep found no direct client-side Supabase writes to:

- `orders`
- `payments`
- `order_items`
- `shipments`
- `refunds`
- `user_roles`
- `admin_order_events`
- `admin_user_events`

Current browser code primarily calls server/Edge endpoints through shared helpers. This is good, but server endpoints still need allowlists, transition checks, idempotency, and DB constraints because UI gating is not a security boundary.

## 3. Admin-Only Actions Needing Backend Enforcement

- `PATCH /admin/orders/:orderId` currently accepts status/payment status style updates and must be constrained by DB/service transition logic.
- `POST /admin/cancellations/:id` must create audit + notification outbox + refund workflow atomically and block shipment-locked orders.
- `POST /admin/returns/:id` and `POST /admin/refunds` need strict transition, amount, and evidence checks.
- Shiprocket create/AWB/pickup/label/bulk paths need idempotency and shipment-lock integration.
- `PATCH /admin/users/:userId` already has last-admin protections in DB migrations, but role changes need reason/audit everywhere.
- Product and coupon admin endpoints use allowlisted payloads but still need DB constraints for negative values and lifecycle-safe deletes/archives.

## 4. Current Status Values and Constraints

Live data inventory from Supabase MCP:

- `orders.status`: `cancelled`
- `orders.payment_status`: `failed`, `paid`, `refunded`
- `checkout_sessions.status`: `pending`, `paid`
- `order_cancellation_requests.status`: `rejected`, `refunded`
- `refunds.status`: `created`
- `products.status`: `active`

Code/migration literals currently include:

- Order statuses: `pending`, `processing`, `confirmed`, `packed`, `shipped`, `out_for_delivery`, `delivered`, `cancellation_requested`, `cancelled`, `return_requested`, `return_approved`, `return_received`, `returned`, `refunded`
- Payment statuses: `pending`, `paid`, `cod_pending`, `cod_cancelled`, `failed`, `partially_refunded`, `refunded`
- Checkout session statuses: `pending`, `processing`, `paid`, `expired`, `failed`
- Shipment statuses include `pending`, `created`, `awb_assigned`, `pickup_scheduled`, `label_generated`, `reverse_pickup_scheduled`
- Return/cancellation/refund statuses include `pending`, `approved`, `rejected`, `refund_pending`, `refunded`, `closed`, `created`, `processed`, `failed`, `cancelled`

Conservative approach: add compatible CHECK constraints and service transition functions before renaming existing statuses to the broader playbook enum.

## 5. Existing RLS and Gaps

Confirmed via Supabase MCP:

- RLS is enabled on all existing public tables.
- `public.is_admin()` exists and delegates to `private.has_role`.
- `user_roles` has single-role enforcement and last-admin guard migrations.

Gaps to fix:

- `products public read` currently allows `true`; public read should be limited to `status = 'active'`, with admins allowed to see all.
- `payments` user SELECT policy exposes full rows; users should not be able to read provider signatures/raw payloads directly.
- Server-owned tables still have some admin direct mutation policies; critical destructive workflows should move to RPC/Edge service functions and append-only audit.
- No generic `notification_outbox` table exists.
- No `provider_webhook_events` idempotency table exists.
- No `inventory_movements` ledger exists.
- No immutable triggers exist for `orders`, `order_items`, `payments`, or audit tables.
- No canonical DB-level order transition/cancellation function exists.

## 6. Safe Implementation Order

1. Add outbox, provider webhook idempotency, and inventory movement tables with RLS and indexes.
2. Add immutable triggers for order snapshots, order items, payments, and audit event rows.
3. Tighten product public SELECT and payment direct SELECT exposure.
4. Add DB order transition/cancellation RPC that locks orders/shipments, rejects illegal transitions, writes audit/outbox/refund inventory side effects.
5. Wire Edge Function admin cancellation/status mutation to RPC instead of arbitrary table updates.
6. Add provider webhook idempotency writes and stale-status rejection for Shiprocket.
7. Add Razorpay/payment duplicate callback tests and DB uniqueness where missing.
8. Add focused security regression tests or SQL test scripts for BOLA, mass assignment, immutable snapshots, invalid transitions, duplicate callbacks, and shipment locks.
9. Update frontend gating to consume backend action availability and typed errors.
10. Run `npm run check`, `npm run lint`, and build validation, treating only the known Windows/Vercel symlink `EPERM` as non-application failure.
