# LapKart Data Loading, Fetching, Caching, Security, and Realtime Audit Prompt

## Purpose

Audit and refactor the LapKart Svelte 5 / SvelteKit 2 ecommerce app so that data loading is efficient, fast, secure, reliable, and free of duplicate requests. Do not change UI/UX, styling, visual layout, animations, or copy unless a tiny change is required to preserve behavior after data-flow refactoring.

LapKart includes customer flows for catalog browsing, product details, cart, checkout, delivery estimation, courier options, Razorpay/COD ordering, order history, and tracking. It also includes admin flows for catalog, stock, product media, coupons, roles, support, notifications, orders, returns, refunds, and Shiprocket fulfillment.

Important routes:

- `/`
- `/products`
- `/product/[id]`
- `/cart`
- `/checkout`
- `/login`
- `/dashboard`
- `/orders`
- `/order/[id]`
- `/admin`
- `/admin/fulfillment`

Primary validation command:

```bash
npm run check
```

On this Windows machine, `npm run build` may hit a Vercel adapter `EPERM` symlink error after successful client/server compilation. Do not treat that adapter symlink issue as a data-loading regression if TypeScript/SvelteKit compilation succeeds before the symlink failure.

---

## Official guidance this audit must follow

Use the current SvelteKit/Svelte/Supabase behavior as the basis for the refactor:

- SvelteKit layout data is inherited by child layouts/pages, so children must not refetch data already returned by a parent layout.
- Server `load` functions run only on the server. Universal `load` functions can run on the server during SSR and in the browser after hydration, so secret-bearing or role-sensitive work must stay server-side.
- SvelteKit’s provided `fetch` inside `load` avoids duplicate hydration requests by serializing responses into the rendered page.
- Use `depends()` and targeted `invalidate()` for custom clients or precise refreshes. Avoid `invalidateAll()` except when all active loads really must rerun.
- `await parent()` can create dependency coupling; use it only when the child genuinely needs parent data inside the load function. Prefer reading inherited data in the Svelte component when possible.
- Realtime subscriptions must clean up their channels. Do not rely on full page reloads.
- In Svelte 5, component lifecycle is creation/destruction oriented; use `onMount` for browser-only subscriptions and return a synchronous cleanup function, or pair with `onDestroy`.
- Supabase recommends Broadcast for scalable/secure realtime database changes, while Postgres Changes are simpler but scale less well.
- SvelteKit remote functions exist in newer SvelteKit versions, but they are experimental. Do not migrate to them unless the project already opted in or the maintainer explicitly approves it.

Reference URLs:

- https://svelte.dev/docs/kit/load
- https://svelte.dev/docs/svelte/lifecycle-hooks
- https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- https://supabase.com/docs/reference/javascript/removechannel
- https://svelte.dev/docs/kit/remote-functions

---

## Non-negotiable rules

1. Do not touch UI/UX.
2. Do not move data fetching into leaf components when the route or parent layout can own it.
3. Do not refetch parent data inside children.
4. Do not fetch the same entity independently from multiple components on the same route.
5. Do not use `window.location.reload()`, `location.reload()`, or full page reloads for realtime updates.
6. Do not call `invalidateAll()` unless every active load on the current page must rerun.
7. Do not expose service role keys, Shiprocket secrets, Razorpay secrets, Ola Maps server secrets, admin-only secrets, or privileged Supabase clients to browser code.
8. Do not trust client-side role checks for admin authorization. Server-side authorization, Supabase RLS, or Edge Function authorization must enforce access.
9. Realtime updates must patch local state or selectively invalidate only the affected dependency.
10. All subscriptions must be cleaned up on component destroy or route exit.
11. Use typed load functions and generated `$types` everywhere.
12. Preserve existing behavior, route URLs, payload shapes, and existing visual output.

---

## Source-of-truth ownership model

| Data category | Owner | Consumers | Notes |
|---|---|---|---|
| Current user/session/profile/role | root or protected layout server load | all pages/layouts | Load once. Children read inherited data. |
| Public featured/catalog summaries | relevant layout/page load or API wrapper | home/products | Select only needed fields. Cache where safe. |
| Product detail | `/product/[id]/+page.server.ts` or safe API load | product page | Fetch once. Pass to components. |
| Cart state | client cart store + validated server checkout fetch | cart/checkout | Batch product validation. Avoid one query per cart item. |
| Checkout delivery estimate/courier options | checkout page/action/API | checkout only | Debounce and cache by address/cart hash. |
| Razorpay payment order | server action/API only | checkout | Never create or verify payment from client-trusted totals. |
| COD eligibility | server action/API/load | checkout | Use server-side rules and latest cart/order state. |
| Order list | `/orders/+page.server.ts` | orders page/components | Paginated. User-scoped. |
| Order detail | `/order/[id]/+page.server.ts` | order detail page/components | User/admin authorization server-side. |
| Admin role/permissions | `/admin/+layout.server.ts` | admin pages | Load once. Redirect/deny server-side. |
| Admin catalog/orders/fulfillment | route-specific server loads/actions | admin child routes | Paginated and filtered. Do not load all records globally. |
| Realtime stock/order events | route-local subscription store | active route/component | Patch affected records; no full reload. |

---

## File-by-file audit workflow

For every file under these paths:

- `src/routes/**`
- `src/lib/**`
- `src/lib/components/**`
- `src/lib/components/admin/**`
- `src/lib/supabase/**`
- `supabase/functions/api/**`

Search for:

```text
supabase.from(
supabase.rpc(
supabase.auth
fetch(
onMount(
onDestroy(
createClient(
.channel(
.subscribe(
removeChannel
unsubscribe
invalidate(
invalidateAll(
goto(
location.reload
window.location.reload
Razorpay
Shiprocket
Ola
localStorage
sessionStorage
```

For every match, classify it as one of:

- page-critical read
- shared parent read
- public read
- user-private read/write
- admin-only read/write
- mutation/action
- realtime subscription
- third-party API call
- cache/state persistence

Then decide ownership:

- If multiple child routes/components need the same data, move it to the nearest shared `+layout.server.ts` or `+layout.ts`.
- If only one page needs the data, keep it in that page’s `+page.server.ts` or `+page.ts`.
- If data access requires cookies, auth, roles, secrets, payment/logistics credentials, or admin checks, keep it in server load, server action, endpoint, or Supabase Edge Function.
- If data is public and safe, universal `load` is acceptable, but avoid browser-side fetching if it duplicates SSR data.
- If a component only displays data, remove direct fetching and accept props.
- If a component owns a realtime subscription, make it a thin subscription wrapper that patches existing route data/stores and cleans itself up.

---

## Required refactor patterns

### Pattern 1: Shared layout data, child consumes inherited data

Use this for user session/profile/role, admin permissions, shared cart summary, or data used across multiple child pages.

```ts
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { session, user, profile, role } = await locals.getSessionProfileRole();

  return {
    session,
    user,
    profile,
    role
  };
};
```

```svelte
<!-- Child route/component: read inherited data instead of refetching -->
<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();

  const user = $derived(data.user);
  const role = $derived(data.role);
</script>
```

Do not do this in a child if parent already loaded it:

```ts
// Bad: duplicate user/profile fetch
const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
```

---

### Pattern 2: Page-specific product load

```ts
// src/routes/product/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, depends }) => {
  depends(`product:${params.id}`);

  const product = await locals.catalog.getProductById(params.id, {
    includeMedia: true,
    includeStock: true,
    includePricing: true
  });

  if (!product) throw error(404, 'Product not found');

  return { product };
};
```

```svelte
<!-- Product components receive product as prop, no duplicate fetch -->
<ProductHero product={data.product} />
<ProductSpecs product={data.product} />
<ProductStock product={data.product} />
```

---

### Pattern 3: Batched cart validation

Avoid this:

```ts
// Bad: one request/query per cart item
for (const item of cart.items) {
  await supabase.from('products').select('*').eq('id', item.product_id).single();
}
```

Use this:

```ts
const productIds = cart.items.map((item) => item.product_id);
const products = await locals.catalog.getProductsByIds(productIds);
const productById = new Map(products.map((product) => [product.id, product]));
```

Return a single validated checkout model:

```ts
return {
  checkout: {
    items: validatedItems,
    subtotal,
    discounts,
    shippingEstimate,
    payableTotal,
    codEligible
  }
};
```

---

### Pattern 4: Targeted invalidation instead of full reload

In load:

```ts
export const load: PageServerLoad = async ({ depends, locals }) => {
  depends('admin:orders');
  const orders = await locals.orders.listAdminOrders({ limit: 50 });
  return { orders };
};
```

After a mutation:

```ts
import { invalidate } from '$app/navigation';

await updateOrderStatus(orderId, status);
await invalidate('admin:orders');
```

Do not use this unless everything must refresh:

```ts
await invalidateAll(); // avoid by default
```

---

### Pattern 5: Realtime state patching without reload

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabase/client';

  let { initialOrders } = $props<{ initialOrders: OrderSummary[] }>();
  let orders = $state(initialOrders);

  function patchOrder(updated: Partial<OrderSummary> & { id: string }) {
    const index = orders.findIndex((order) => order.id === updated.id);
    if (index === -1) return;
    orders[index] = { ...orders[index], ...updated };
  }

  onMount(() => {
    if (!browser) return;

    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => patchOrder(payload.new as OrderSummary)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  });
</script>
```

Forbidden realtime behavior:

```ts
window.location.reload();
location.reload();
await invalidateAll(); // only acceptable if intentionally documented and unavoidable
```

---

### Pattern 6: Server-only integrations

Razorpay, Shiprocket, and privileged Ola Maps calls must stay server-side.

```ts
// Good: server action or endpoint
export const actions = {
  createPaymentOrder: async ({ request, locals }) => {
    const input = await request.formData();
    const result = await locals.payments.createRazorpayOrder(input);
    return result;
  }
};
```

Browser code may request the operation, but must not calculate trusted totals, hold secrets, or bypass server validation.

---

## Route-specific audit instructions

### `/`

- Load featured categories/products once.
- Avoid each homepage section fetching its own products.
- Use field-limited queries: product id, slug/id, name, price summary, thumbnail, stock badge, featured rank.
- If multiple sections share catalog summaries, use one batched call and split in memory.

### `/products`

- Search/filter/sort/page state should be represented in URL search params where appropriate.
- Load only the current page of results.
- Debounce client-side search input before navigation/fetch.
- Avoid fetching all products then filtering in the browser.
- Avoid duplicate fetches between filters, product grid, and counts. Return `{ products, pagination, facets }` from one load/API call when possible.

### `/product/[id]`

- Fetch product detail once.
- Components must not refetch product, media, price, stock, compatibility, or related metadata already returned in page data.
- Related products may be streamed/lazily loaded if non-critical.
- Stock realtime should patch the displayed stock only; no full reload.

### `/cart`

- Cart UI can use client store for responsiveness.
- Server validation should batch product ids.
- Do not trust stale client prices/stock.
- Avoid fetching product detail repeatedly on every quantity click. Use local optimistic updates, then validate on checkout.

### `/checkout`

- Address/geocode/courier option calls must be debounced and cached by `{ cartHash, pincode/location/addressHash }`.
- Courier options should not refetch if only unrelated UI state changes.
- Razorpay order creation must happen once per deliberate payment attempt, not on every render.
- COD eligibility must be returned by server validation.
- Payment verification must be server-side.

### `/dashboard`, `/orders`, `/order/[id]`

- Load session/profile/role from parent once.
- Orders list must be user-scoped and paginated.
- Order detail must be authorized server-side.
- Realtime order tracking should patch order status/tracking fields or invalidate only `order:{id}`.

### `/admin`

- Admin layout must load and enforce admin role once.
- Child admin pages must consume inherited admin identity/permissions.
- Do not fetch admin role separately in every admin component.
- Do not load all orders/products globally in admin layout unless every child route uses them.

### `/admin/fulfillment`

- Shiprocket actions must be server-side.
- AWB/pickup/label/tracking updates should patch the affected order/fulfillment row.
- Avoid reloading the entire admin page after label generation or pickup scheduling.
- Polling, if any, must be bounded and stopped on destroy.

---

## Supabase query rules

For every Supabase query:

1. Select only required columns. Avoid `select('*')` unless justified.
2. Add `.limit()` for lists.
3. Add pagination for admin orders/products and public product catalog.
4. Add proper filters before fetching.
5. Use `.single()` only when exactly one row must exist; handle not found cleanly.
6. Use `.maybeSingle()` when absence is normal.
7. Keep service-role usage out of browser imports.
8. Confirm RLS policies match the access pattern.
9. Move repetitive query logic into typed repository functions under a server-only module if it uses privileged access.
10. Deduplicate by creating one repository call per route instead of scattered queries in components.

Suggested server repository shape:

```ts
// src/lib/server/catalog.ts
export async function getProductPage({ query, page, sort, filters }: ProductSearchInput) {
  // validate input
  // construct one field-limited, paginated query
  // return products + pagination + facets/counts if needed
}

export async function getProductById(id: string) {
  // return full product detail for product page
}

export async function getProductsByIds(ids: string[]) {
  // batch cart/order validation
}
```

---

## Realtime audit rules

For every realtime subscription:

- It must be created in browser-only code.
- It must be scoped to the current page/user/admin context as tightly as possible.
- It must not subscribe to broad tables unnecessarily.
- It must patch local state, update a store, or call targeted `invalidate('scope:key')`.
- It must call `supabase.removeChannel(channel)` or equivalent cleanup.
- It must not call full reload.
- It must not create duplicate channels on every state update.
- It must guard against duplicate subscriptions caused by component remounts.
- It must document the state patch strategy.

Patch strategy examples:

| Event | Preferred response |
|---|---|
| product stock update on product page | patch `product.stock` locally |
| order status update on order detail | patch `order.status`, `tracking`, `timeline` |
| admin order update in list | update only matching row |
| new support question in admin list | prepend if it matches current filters, otherwise increment badge/count |
| stock notification event | update notification count/store only |

---

## Security audit rules

Check every data path for:

- secrets imported into browser-facing files
- admin role checked only in Svelte component code
- service role Supabase client used in `src/lib` instead of `src/lib/server` or Edge Function
- direct client calls that can change order status, stock, coupons, refunds, fulfillment, or roles
- payment amount trusted from client
- courier choice trusted without server verification
- order detail accessible by guessing id
- missing RLS policies for public/user/admin tables
- broad realtime channels leaking rows to unauthorized users

Required fixes:

- Move privileged operations to server load/actions/endpoints/Edge Functions.
- Validate all inputs server-side.
- Enforce user ownership/admin permissions before returning data.
- Keep public anon client limited to RLS-protected operations.
- Keep service role client server-only.

---

## Performance audit rules

Check every route for:

- duplicate network calls during hydration
- component-level fetches that duplicate load data
- waterfall loading caused by unnecessary `await parent()` or sequential unrelated queries
- repeated cart/product queries inside loops
- unnecessary `select('*')`
- unbounded admin lists
- expensive dashboard aggregates loaded on every admin child route
- realtime events triggering full reruns
- courier/geocode calls fired for every keystroke
- missing memoization/cache for stable public data

Required fixes:

- Use SvelteKit `load` `fetch` when fetching internal endpoints from load.
- Use `Promise.all` for independent server queries.
- Stream non-critical slow promises only when it improves first render and errors are handled.
- Move shared data upward; move route-specific heavy data downward.
- Use targeted `depends()` keys for non-fetch clients.
- Use debouncing and request cancellation for search/address input.
- Batch product/cart/order lookups.
- Paginate everything that can grow.

---

## Reliability audit rules

- Every load/action must handle not found, unauthorized, validation failure, third-party failure, and network failure.
- Use SvelteKit `error`/`redirect` appropriately in server loads/actions.
- Do not swallow errors silently.
- For checkout and payments, ensure idempotency where repeated clicks/network retries can happen.
- For Shiprocket actions, store request/response status so the admin surface can recover after partial failure.
- For realtime, handle payloads for rows that are not currently visible.
- For optimistic UI, revert or reconcile after server response.

---

## Deliverables required from the coding agent

Create or update a markdown report in the repo, for example:

```text
DATA_LOADING_AUDIT.md
```

The report must include:

1. Files audited.
2. Duplicate fetches found.
3. Parent data that was being refetched by children.
4. Component-level fetches moved to route loads/actions.
5. Realtime reloads removed.
6. `invalidateAll()` occurrences and whether they were removed or justified.
7. Security-sensitive browser fetches moved server-side.
8. Query optimizations made.
9. Remaining risks or TODOs.
10. Validation results from `npm run check`.

For every code change, include:

- old behavior
- new behavior
- why it is safe
- which route was affected
- how duplicate loading was removed
- how realtime now updates without reload

---

## Final verification commands

Run:

```bash
npm run check
```

Also run targeted searches after refactor:

```bash
rg "location\.reload|window\.location\.reload|invalidateAll\(" src supabase
rg "select\('\*'\)|select\(\"\*\"\)" src supabase
rg "\.channel\(|\.subscribe\(" src
rg "supabase\.from\(|supabase\.rpc\(|fetch\(" src/routes src/lib src/lib/components supabase/functions/api
rg "Razorpay|Shiprocket|OLA|Ola|service_role|SERVICE_ROLE" src supabase api
```

Expected result:

- No full page reloads for realtime.
- No unjustified `invalidateAll()`.
- No service role or third-party secrets in browser code.
- No duplicate parent/user/admin role loads in child routes.
- No repeated product/order fetch loops where batching is possible.
- `npm run check` passes, except do not misclassify the known Windows Vercel adapter symlink `EPERM` as a data-flow error.

---

## Start the audit now

Act as a senior SvelteKit/Supabase performance and security engineer. Audit the full repo file-by-file using the rules above. Make minimal, behavior-preserving changes only. Keep the existing UI/UX untouched. Prefer small, reviewable commits/patches. After each route group, update `DATA_LOADING_AUDIT.md` with findings and fixes.
