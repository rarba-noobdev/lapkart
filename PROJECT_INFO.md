# LapKart Project Info

## What This App Is

LapKart is an e-commerce application focused on laptop components and replacement hardware. It is built for customers who want to browse, compare, and buy parts such as RAM, SSDs, batteries, displays, chargers, processors, and other repair or upgrade components.

The app also includes an internal operations/admin surface for catalog control, order management, shipment creation, fulfillment tracking, and customer/account administration.

In practical terms, this project is both:

- a customer-facing storefront for buying laptop parts
- an admin operations console for running the business

## What The App Is Used For

### Customer use cases

- browse available laptop parts
- search and filter catalog items
- view pricing, stock, and product details
- add products to cart
- choose a delivery location using Ola Maps
- see delivery estimates before paying
- pay using Razorpay
- place orders
- track order and shipment progress
- manage account and view past orders

### Admin use cases

- manage product catalog
- create, edit, archive, and delete products
- control pricing, stock, category, media, and shipping metadata
- manage users and roles
- review and edit orders
- create Shiprocket shipments
- assign AWBs
- generate pickups
- view fulfillment progress and tracking
- monitor business analytics and operational status

## High-Level Architecture

LapKart uses a React frontend with Supabase as the main backend platform.

### Frontend

- React
- Vite
- TanStack Router
- TanStack Query
- Supabase client
- Framer Motion
- Radix UI primitives

### Backend

- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Function for server-side business logic

### Third-party services

- Razorpay for payments
- Shiprocket for logistics and shipment operations
- Ola Maps for location search, reverse geocoding, and delivery estimation

## Current Project Structure

```text
lapkart/
├─ src/
│  ├─ assets/
│  ├─ components/
│  ├─ hooks/
│  ├─ integrations/
│  │  └─ supabase/
│  ├─ lib/
│  └─ routes/
├─ supabase/
│  ├─ functions/
│  │  └─ api/
│  ├─ migrations/
│  └─ config.toml
├─ api/                  # legacy Express backend reference
├─ public/
├─ scripts/
├─ design_system.md
├─ ARCHITECTURE.md
├─ DATABASE_VIEW.md
├─ package.json
├─ vite.config.ts
├─ vercel.json
└─ render.yaml
```

## Frontend Structure

```text
src/
├─ components/
│  ├─ DashboardShell.tsx
│  ├─ DeliveryMapPicker.tsx
│  ├─ Footer.tsx
│  ├─ Header.tsx
│  ├─ LoadingSkeletons.tsx
│  └─ ProductCard.tsx
├─ integrations/supabase/
│  ├─ client.ts
│  ├─ client.server.ts
│  ├─ auth-attacher.ts
│  ├─ auth-middleware.ts
│  └─ types.ts
├─ lib/
│  ├─ api-base.ts
│  ├─ auth.tsx
│  ├─ cart-store.ts
│  ├─ catalog.ts
│  ├─ products-db.ts
│  ├─ supabase-auth.ts
│  ├─ use-realtime-refresh.ts
│  └─ utils.ts
└─ routes/
   ├─ __root.tsx
   ├─ _authenticated.tsx
   ├─ index.tsx
   ├─ products.tsx
   ├─ product.$id.tsx
   ├─ cart.tsx
   ├─ login.tsx
   ├─ dashboard.tsx
   └─ _authenticated/
      ├─ checkout.tsx
      ├─ orders.tsx
      ├─ order.$id.tsx
      └─ admin.tsx
```

## Supabase Backend Structure

```text
supabase/
├─ functions/api/
│  ├─ index.ts
│  ├─ config.ts
│  ├─ ola-maps.ts
│  ├─ payments.ts
│  └─ shiprocket.ts
└─ migrations/
```

## Main Features Implemented

## Storefront

- homepage with merchandising and featured shelves
- product catalog listing
- product detail pages
- search and category browsing
- cart flow
- loading skeletons for main customer pages

## Authentication and Roles

- Supabase Auth integration
- email/password login and signup
- Google OAuth login
- two-role model: `admin` and `user`
- new users default to `user`
- role-based redirects and route behavior

## Customer Account

- customer dashboard
- order history
- order detail page
- address hydration from saved addresses

## Checkout and Payment

- backend-generated Razorpay orders
- Razorpay Standard Checkout client integration
- server-side signature verification
- backend-controlled order creation after payment verification
- payment failure handling
- customer prefill data in Razorpay checkout

## Delivery and Maps

- Ola Maps autocomplete
- reverse geocoding
- pin placement and GPS support
- route-based delivery estimate calculation
- address autofill from map selection

## Logistics

- Shiprocket serviceability and courier quotes
- standard and quick delivery support
- shipment creation
- AWB assignment
- pickup generation
- tracking retrieval and persistence
- fulfillment event handling

## Admin Operations

- admin dashboard
- analytics summary
- catalog CRUD
- user management
- order management
- fulfillment queue
- shipment detail and pack view
- editable operational fields for orders and users

## Realtime and State Refresh

- realtime refresh hooks using Supabase subscriptions where needed
- order detail refresh
- admin operational refresh paths

## Security and Data Integrity

- role-aware backend route protection
- fresh token retrieval before protected API requests
- checkout writes moved away from client-side direct DB writes
- backend payment verification before order completion
- RLS hardening through migrations
- rate limiting in backend edge function
- protected admin upload flow

## Core Route Overview

### Public/customer routes

- `/` - homepage
- `/products` - product listing
- `/product/:id` - product details
- `/cart` - cart
- `/login` - login/signup
- `/dashboard` - customer dashboard

### Authenticated routes

- `/checkout` - checkout and payment flow
- `/orders` - customer order list
- `/order/:id` - customer order detail/tracking
- `/admin` - admin operations console

## Current Backend Flow

The current backend flow is centered around the Supabase Edge Function router in `supabase/functions/api`.

It handles:

- payment order creation
- payment completion and verification
- admin analytics endpoints
- admin CRUD endpoints
- Ola Maps proxy routes
- Shiprocket account, fulfillment, AWB, pickup, and tracking routes
- storage upload routes
- logistics event ingestion

The `api/` folder still exists as a legacy Express backend reference, but the active architecture is Supabase-based.

## Database Direction

The database layer is Supabase Postgres with migrations for:

- auth and role rules
- product and order security
- shipment and logistics schema
- checkout session workflow
- hardening of row-level security and service-role-only write paths

## Important Operational Notes

### Roles

- `user` is the default role for new accounts
- `admin` is intended for manual assignment only

### Payments

- Razorpay order creation is server-side
- successful payment must be verified server-side before finalizing the order

### Logistics

- Shiprocket is used after the order/payment flow
- order fulfillment is managed from the admin panel

### Maps

- Ola Maps is used before payment so the app can estimate route and courier availability

## What Still Needs Attention

The app has strong operational and payment foundations, but some business/compliance surfaces are still incomplete.

Examples:

- public policy pages
- public about/contact pages
- Razorpay live website review readiness
- production CORS/env consistency across local and hosted environments
- bundle size optimization for large frontend chunks

## Summary

LapKart is a production-oriented laptop-parts commerce application with:

- a customer storefront
- a secure checkout pipeline
- map-based delivery estimation
- logistics integration
- a full admin operations console

It is designed to manage the full flow from login to checkout to shipment creation and tracking, using Supabase as the primary backend platform.
