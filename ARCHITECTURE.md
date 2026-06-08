# LapKart Architecture

LapKart is a Vite React e-commerce frontend with a Node/Express API and Supabase backend.

## Frontend

- React, TypeScript, TailwindCSS, Framer Motion, and ShadCN UI primitives.
- Public catalog, product pages, cart, checkout, customer dashboard, order views, and admin command center.
- Supabase Auth supports normal customer accounts. New accounts receive the `user` role automatically.

## Backend

- `api/src/server.ts` exposes commerce API contracts for Razorpay orders, Razorpay signature verification, Ola Maps address lookup and routes, Shiprocket standard and Quick quotes, Shiprocket shipment administration, storage uploads, fraud-risk scoring, and admin analytics.
- `api/src/payments.ts` centralizes Razorpay order creation and verification.
- `api/src/ola-maps.ts` centralizes Ola Maps OAuth, autocomplete, reverse geocoding, and route estimates.
- `api/src/shiprocket.ts` centralizes Shiprocket authentication, standard courier quotes, Quick hyperlocal quotes, and shipment payloads.
- `api/src/risk.ts` contains deterministic payment risk scoring.

## Supabase

- Core tables include profiles, user roles, products, addresses, orders, order items, payments, shipments, shipment packages, shipment events, pickup locations, shipping batches, and shipping batch items.
- Roles are limited to `admin` and `user` through `public.app_role`.
- New auth users are inserted into `public.user_roles` as `user`.
- Client-side role writes are blocked by RLS. Admin promotion is a manual database update.
- Active storage buckets: `products` and `users`. Historical empty buckets should be removed through the Storage UI or Storage API.

## Delivery

- Ola Maps resolves the checkout address and estimates driving distance and time.
- Shiprocket standard courier estimates and Shiprocket Quick hyperlocal estimates are requested before payment.
- Quick estimates use Shiprocket's documented hyperlocal serviceability parameters, including pickup and drop coordinates.
- The selected delivery type is persisted as `standard` or `quick` on the order and shipment.

## Deployment

- Frontend: Vercel using `vercel.json`.
- API: Render using `render.yaml`.
- Container: `Dockerfile` builds the API runtime.

## Required Secrets

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`
- `VITE_OLA_MAPS_API_KEY`

API:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SHIPROCKET_EMAIL`
- `SHIPROCKET_PASSWORD`
- `SHIPROCKET_PICKUP_LOCATION`
- `LAPKART_DISPATCH_PINCODE`
- `LAPKART_DISPATCH_LATITUDE`
- `LAPKART_DISPATCH_LONGITUDE`
- `OLA_MAPS_CLIENT_ID`
- `OLA_MAPS_CLIENT_SECRET`
