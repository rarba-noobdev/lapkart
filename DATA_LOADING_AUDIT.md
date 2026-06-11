# LapKart Data Loading Audit

Date: 2026-06-07

## Scope Audited

- SvelteKit route loads: `src/routes/+layout.server.ts`, `src/routes/+layout.ts`, `src/routes/+page.server.ts`, `src/routes/products/+page.server.ts`, `src/routes/product/[id]/+page.server.ts`, `src/routes/orders/+page.server.ts`, `src/routes/order/[id]/+page.server.ts`, `src/routes/profile/+page.server.ts`, `src/routes/admin/+page.server.ts`.
- Svelte route/components with data side effects: `src/routes/+layout.svelte`, `src/routes/admin/+page.svelte`, `src/routes/checkout/+page.svelte`, `src/routes/order/[id]/+page.svelte`, `src/lib/components/DeliveryMapPicker.svelte`, `src/lib/components/admin/AdminOrdersManager.svelte`, `src/lib/components/admin/AdminSupportManager.svelte`, `src/lib/components/admin/FulfillmentQueue.svelte`.
- Shared data helpers: `src/lib/products.ts`, `src/lib/server/product-search.ts`, `src/lib/orders.ts`, `src/lib/admin.ts`, `src/lib/supabase/**`.
- Edge Function API surface: `supabase/functions/api/**`.

## Code Changes

| File | Route / surface | Old behavior | New behavior | Why safe | Duplicate loading removed | Realtime strategy |
| --- | --- | --- | --- | --- | --- | --- |
| `src/routes/+layout.svelte` | All routes | Profile realtime subscription was rechecked every 500ms with `setInterval`. | Profile channel syncs on initial mount and Supabase auth state changes only. | Auth events are the source of user/session changes; cleanup still removes the channel. | Removes global background polling on every page. | Existing profile/user-role postgres changes still invalidate only `app:profile` / `supabase:auth`. |
| `src/routes/+page.server.ts` | `/` | Loaded all products with full product detail fields. | Uses `listCatalogProducts({ limit: 96 })` and `depends('app:products')`. | Home UI only needs catalog card data; 96 keeps the current small catalog visible while bounding first load. | Removes unbounded full-row homepage product load. | Product changes can use `app:products` instead of broad reloads. |
| `src/lib/products.ts` | Catalog helpers | `listCatalogProducts` supported only `.limit()`. | Adds page-aware `.range()` with a 250 item cap. | Preserves existing filters/sorts and gives routes bounded paging. | Prevents accidental unbounded catalog scans when a page is specified. | N/A. |
| `src/routes/products/+page.server.ts` | `/products` | Search route did not pass a page/limit to the shared search helper. | Parses `page`, passes a bounded page size, returns page metadata. | Current UI remains unchanged; Postgres search returns total, Supabase fallback is bounded. | Prevents loading an unbounded catalog card set per request. | Uses existing `depends('app:products')`. |
| `src/lib/server/product-search.ts` | Search/index sync | Supabase fallback ignored `page`; sync events used `select('*')`. | Passes page to `listCatalogProducts`; sync event query selects only `id,product_id,operation,status,attempts`. | Sync loop only reads those fields. | Removes unnecessary event-column loading. | N/A. |
| `src/lib/orders.ts` | Order helper | User order helper always loaded all order summaries. | Optional `limit` parameter. | Existing callers without a limit keep old behavior; route callers now opt into bounded loads. | Enables bounded `/orders` and `/profile` loads. | N/A. |
| `src/routes/orders/+page.server.ts` | `/orders` | Loaded all user orders. | Loads latest 50 and tags `depends('orders:user:{id}')`. | Keeps the page useful for normal account history while bounding SSR work. | Removes unbounded user order list render. | Targeted invalidation key available. |
| `src/routes/order/[id]/+page.server.ts` | `/order/[id]` | No order-specific dependency key. | Adds `depends('order:{id}')`. | Data ownership is unchanged and still user-scoped on the server. | Avoids needing broad invalidation for one order. | Order page subscriptions now target this key. |
| `src/routes/order/[id]/+page.svelte` | `/order/[id]` | Manual tracking refresh did not refresh route data; no live order updates. | Subscribes to `orders`, `order_items`, `payments`, and `shipments` for the current order and debounces `invalidate('order:{id}')`. | Filters are order-scoped and cleanup removes the channel. | Avoids manual full-page reload patterns. | Realtime updates invalidate only the current order. |
| `src/routes/product/[id]/+page.server.ts` | `/product/[id]` | No product-specific dependency key. | Adds `depends('product:{id}')`. | Product lookup behavior unchanged. | Avoids broad product invalidation for detail views. | Targeted key available. |
| `src/routes/profile/+page.server.ts` | `/profile` | Loaded all order summaries and selected all address fields. | Loads latest 10 order summaries, computes totals from lean `id,total`, selects explicit address fields with limit 20, tags profile/orders dependencies. | Profile counters stay truthful; rendered list is bounded. | Removes heavy full order relation load from profile. | Targeted keys available. |
| `src/routes/admin/+page.svelte` | `/admin` | Every realtime admin event refreshed analytics plus every already-open section. | Realtime refresh is table-aware: orders/payments refresh analytics; products refresh analytics/catalog; profiles/roles refresh users; coupons/redemptions refresh coupons. | Existing lazy section cache is preserved; only relevant loaded sections refresh. | Prevents unrelated admin sections from refetching after every event. | Single admin channel, debounced 300ms, cleanup clears timer and channel. |
| `src/routes/checkout/+page.svelte` | `/checkout` | Checkout state sync polled every 250ms; saved addresses used `select('*')`; delivery estimates refetched for repeated cart/address hashes. | Uses reactive effect instead of interval, explicit address fields with limit 20, and `SvelteMap` cache for delivery estimate hashes. | Same checkout state machine, but it runs only when reactive inputs change. | Removes checkout polling and repeated estimate requests. | N/A. |
| `src/lib/components/DeliveryMapPicker.svelte` | Checkout address picker | Reverse geocode calls were not abortable/cached. | Adds abort controller and `SvelteMap` cache keyed by rounded coordinate/place id. | Existing autocomplete behavior remains; stale reverse-geocode responses no longer win races. | Avoids repeated reverse-geocode calls for the same pin. | N/A. |
| `supabase/functions/api/index.ts` | Admin API | Admin products/coupons endpoints used `select('*')`. | Adds explicit `adminProductSelect` and `adminCouponSelect` field lists. | Matches the admin UI/editor contract exactly. | Removes full-row admin catalog/coupon API payloads. | N/A. |

## Findings

- Duplicate fetches removed:
  - Root profile polling every 500ms.
  - Checkout polling every 250ms.
  - Repeated checkout delivery estimate requests for identical address/cart value.
  - Repeated reverse-geocode requests for identical selected pins.
  - Admin realtime blanket refetch of unrelated loaded sections.
- Parent refetch control:
  - Existing root layout auth/session ownership is preserved.
  - Added route-level dependency keys: `app:products`, `orders:user:{id}`, `order:{id}`, and `product:{id}`.
  - No `invalidateAll()` usage remains in `src` or `supabase`.
- Component fetches:
  - Checkout/map component fetches remain client-side because they depend on cart state, user-entered address, browser geolocation, and deliberate checkout actions.
  - Address and estimate fetches are now bounded, abortable where appropriate, and cached by stable keys.
- Security/browser fetches:
  - Razorpay payment order, COD order, checkout completion, Ola autocomplete/reverse geocode, and Shiprocket delivery estimate flows still go through backend endpoints.
  - No service-role key is used in browser code.
  - Razorpay Checkout script remains client-side by design because it is the provider UI.
- Query optimizations:
  - Homepage product data uses card fields and a hard limit.
  - Product search has a hard page size.
  - Orders and profile order lists are bounded.
  - Profile and checkout address queries select explicit fields.
  - Admin catalog/coupon endpoints select explicit fields.

## Remaining Risks / TODOs

- `supabase/functions/api/index.ts` still has `select('*')` in provider/fulfillment/refund/order-internal paths. These are service-role backend operations that often pass whole rows into business-rule helpers or provider payload builders. I did not mass-edit them in this frontend loading pass because field-pruning those flows should be done with endpoint-specific tests for cancellation, return, refund, shipment, pickup, label, and tracking behavior.
- `AdminOrdersManager.svelte`, `AdminSupportManager.svelte`, and `FulfillmentQueue.svelte` still refresh their own section data on relevant realtime events. They are lazy-mounted and debounced, but a deeper pass could patch individual records locally after each postgres change.
- Browser-console smoke testing was limited because Playwright is not installed in this repo. HTTP route smoke tests and Svelte/build validation passed.

## Validation

- `node_modules/.bin/svelte-mcp list-sections` and relevant SvelteKit docs were consulted before implementation.
- `node_modules/.bin/svelte-mcp svelte-autofixer` on changed Svelte files:
  - No hard issues.
  - Remaining suggestions are generic warnings for intentional side-effect effects in checkout/map picker.
- `npm run check`: passed, `svelte-check found 0 errors and 0 warnings`.
- `npm run build`: passed.
- Local dev smoke with temporary Vite server:
  - `GET /products`: 200
  - `GET /products?category=batteries`: 200
  - `GET /checkout`: 200
  - `GET /admin` unauthenticated: 307 redirect
  - `GET /order/test-order-id` unauthenticated: 307 redirect
- Audit searches:
  - `rg "location\.reload|window\.location\.reload|invalidateAll\(" src supabase`: no matches.
  - `rg "setInterval\(" src/routes src/lib src/lib/components`: no matches.
  - `rg -F "select('*')" src supabase` / `rg -F 'select("*")' src supabase`: no `src` matches; remaining matches are backend `supabase/functions/api/index.ts` internals listed above.
  - `rg "\.channel\(|\.subscribe\(" src`: subscriptions are present in root profile, admin shell, order detail, cart store, and lazy admin section managers; all realtime channels added/modified in this pass have cleanup.
  - `rg "supabase\.from\(|supabase\.rpc\(|fetch\(" src/routes src/lib src/lib/components supabase/functions/api`: reviewed; remaining client fetches are deliberate user/action/location/provider flows.
  - `rg "Razorpay|Shiprocket|OLA|Ola|service_role|SERVICE_ROLE" src supabase api`: reviewed; service-role values remain server-side config/migrations, provider calls remain backend except Razorpay Checkout UI and public Ola static-map key usage.
