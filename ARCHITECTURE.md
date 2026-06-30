# LapKart Architecture

LapKart is a Vite React e-commerce frontend with a Node/Express API and Supabase backend.

## Frontend

- React, TypeScript, TailwindCSS, Framer Motion, and ShadCN UI primitives.
- Public catalog, product pages, cart, checkout, customer dashboard, order views, and admin command center.
- Supabase Auth supports normal customer accounts. New accounts receive the `user` role automatically.

## Backend

- `supabase/functions/api/index.ts` exposes commerce contracts for Razorpay, Ola Maps, delivery estimates, manual shipment administration, storage uploads, fraud-risk scoring, and admin analytics.
- `api/src/payments.ts` centralizes Razorpay order creation and verification.
- `api/src/ola-maps.ts` centralizes Ola Maps OAuth, autocomplete, reverse geocoding, and route estimates.
- Manual shipment records and staff actions are handled directly by the Edge Function and Postgres.
- `api/src/risk.ts` contains deterministic payment risk scoring.

## Supabase

- Core tables include profiles, user roles, products, addresses, orders, order items, payments, shipments, shipment packages, shipment events, pickup locations, shipping batches, and shipping batch items.
- Roles are limited to `admin` and `user` through `public.app_role`.
- New auth users are inserted into `public.user_roles` as `user`.
- Client-side role writes are blocked by RLS. Admin promotion is a manual database update.
- Active storage buckets: `products` and `users`. Historical empty buckets should be removed through the Storage UI or Storage API.

## Delivery

- Ola Maps resolves the checkout address and estimates driving distance and time.
- Delivery estimates are calculated from the configured dispatch point and Ola Maps route data.
- Standard and quick delivery choices are stored as order estimates; staff dispatch remains manual.
- The selected delivery type is persisted as `standard` or `quick` on the order and shipment.

## Deployment

- Frontend: Vercel using `vercel.json`.
- API: Supabase Edge Function (`supabase/functions/api`), reached at `${SUPABASE_URL}/functions/v1/api`. `VITE_API_BASE_URL` points the client at it.

## Required Secrets

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`
- `VITE_OLA_MAPS_API_KEY`

Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `MANUAL_PICKUP_LOCATION`
- `MANUAL_DEFAULT_WEIGHT_KG`
- `MANUAL_DEFAULT_LENGTH_CM`
- `MANUAL_DEFAULT_BREADTH_CM`
- `MANUAL_DEFAULT_HEIGHT_CM`
- `LAPKART_DISPATCH_PINCODE`
- `LAPKART_DISPATCH_LATITUDE`
- `LAPKART_DISPATCH_LONGITUDE`
- `OLA_MAPS_CLIENT_ID`
- `OLA_MAPS_CLIENT_SECRET`
