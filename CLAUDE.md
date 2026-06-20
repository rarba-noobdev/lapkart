# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LapKart is a SvelteKit 2 ecommerce storefront for laptop replacement parts. It includes a customer-facing catalog with search, cart, checkout (Razorpay + COD), order tracking, and a staff-facing admin dashboard for orders, fulfillment (Shiprocket), catalog, and support. Mobile builds use Capacitor for Android.

## Commands

```bash
npm run dev           # Start dev server (Vite, port 5173)
npm run build         # Production build
npm run preview       # Preview production build locally
npm run check         # svelte-kit sync + svelte-check (type checking)
npm run check:watch   # Type checking in watch mode
npm run lint          # prettier --check + eslint
npm run format        # prettier --write
```

No test suite exists. No vitest or playwright config.

## Stack

- **Framework:** Svelte 5 (runes mode enforced) + SvelteKit 2
- **Styling:** Tailwind CSS v4 (utility classes, design tokens in `src/app.css`)
- **Database:** Supabase PostgreSQL with RLS, Realtime, Storage
- **Auth:** Supabase Auth (email/password), server-side session via cookies
- **Search:** Supabase PostgreSQL full-text/trigram search with basic query fallback
- **Payments:** Razorpay (client-side SDK loaded on `window.Razorpay`)
- **Logistics:** Shiprocket integration for shipments/tracking
- **Maps:** Ola Maps for address picker and delivery estimates
- **Deploy:** Vercel (adapter-vercel when `VERCEL` env set, adapter-auto otherwise)
- **Mobile:** Capacitor Android app in `android/`, app ID `com.lapkart.store`.

## Architecture

### Data Flow

Server load functions (`+page.server.ts`) fetch data via `locals.supabase` and pass it as props to Svelte page components. Universal layout load (`+layout.ts`) creates the appropriate Supabase client (server vs browser) and passes auth state. Client-side cart uses localStorage (`lapkart_cart_v1` key), hydrated on mount.

### Auth & Roles

`hooks.server.ts` creates a server Supabase client, attaches `locals.safeGetSession()` and `locals.getRole()` (cached per request). Route guards:

- `/admin*` requires `owner` or `admin` role, else redirect to `/profile`
- `/checkout`, `/orders`, `/order/*`, `/profile` require auth, else redirect to `/login`
- Staff on customer routes redirect to `/admin`

Roles: `owner | admin | user`. Stored in `user_roles` table. Staff = owner or admin. Use `isStaffRole()` from `$lib/roles` for checks.

Auth context (`$lib/auth-context.ts`) provides reactive `{ supabase, session, user, role, claims }` via Svelte context API, consumed in components via `getAuthContext()`.

### Product Search

Database-native search in `$lib/server/product-search.ts`:

1. **Postgres RPC** `public.search_active_products` uses full-text search plus trigram indexes across title/brand/category/description/sku/compatibility/warranty/highlights/search_keywords. It handles filters, relevance, sorting, pagination, and totals in one database round trip.
2. **Supabase query fallback** uses bounded ILIKE matching if the RPC is unavailable during migration rollout.

No external search service is required. Catalog edits are immediately searchable from the products table; admin saves only invalidate the SvelteKit products dependency.

### Key Data Modules

| Module             | Purpose                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `$lib/products.ts` | Product queries: list, get, search, related items. `normalizeProductRow()` converts DB rows to `Product` type.                  |
| `$lib/orders.ts`   | Customer order queries: list (paginated), get by ID. Joins order_items, shipments, payments.                                    |
| `$lib/admin.ts`    | Admin operations: order management, fulfillment (Shiprocket), stock/pricing updates, coupon CRUD, role management, support Q&A. |
| `$lib/cart.ts`     | Client-side cart store (Svelte writable). localStorage-backed with `hydrateCart()` on mount.                                    |
| `$lib/catalog.ts`  | Static category list (16 categories), `Product` type, `discountPct()`, `formatINR()`.                                           |

### Realtime

Layout subscribes to Supabase Realtime channels per authenticated user: `profiles` table changes invalidate `app:profile`, and `user_roles` changes invalidate `supabase:auth`. Enables cross-tab sync of profile/role updates.

### API Routes

- `GET /api/search/products` - Client-side product search (cache: private, max-age=20)
- `GET /auth/callback` - OAuth code exchange
- `POST /auth/signout` - Sign out

### Admin Dashboard

Single large page at `/admin/+page.svelte` with section-based routing via `?section=` query param. Sections: catalog, orders, fulfillment, users, promos, support. Components in `$lib/components/admin/`.

## Conventions

- **Svelte 5 runes mode** enforced project-wide. Use `$state`, `$derived`, `$props`, `$effect`, not legacy `let`/`$:` reactivity.
- **Formatting:** Tabs, single quotes, no trailing commas, 100 char width. Run `npm run format` before committing.
- **Supabase client:** Server routes use `locals.supabase`. Client components access via `getAuthContext().supabase` or the `$lib/supabase/client` singleton.
- **DB types:** Generated in `$lib/supabase/types.ts`. When schema changes, regenerate with Supabase CLI.
- **Server-only code** lives in `$lib/server/`; SvelteKit prevents client import.
- **Product data normalization:** Use `normalizeProductRow()` when reading direct product rows from DB to ensure consistent types (numeric coercion, null to undefined).
- **Currency formatting:** `formatINR()` in `$lib/catalog.ts` uses `toLocaleString('en-IN')` with INR prefix.
- **Icons:** `@lucide/svelte`; import individual icons, don't import the barrel.

## Environment Variables

**Required for dev:**

```bash
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

**Required for full functionality:**

```bash
VITE_RAZORPAY_KEY_ID          # Payments
VITE_OLA_MAPS_API_KEY         # Address picker
```

See `.env.example` for the full list. Public Supabase values are also pinned in `vercel.json`.

## Database

Supabase PostgreSQL. Migrations in `supabase/migrations/` (20+ files). Key tables: `products`, `orders`, `order_items`, `shipments`, `payments`, `profiles`, `addresses`, `user_roles`, `admin_order_events`.

RLS enforced on all tables. Admin actions validated server-side, not just client-side role checks.
