# LapKart Project Info

## Overview

LapKart is a Svelte 5 and SvelteKit 2 ecommerce application for laptop parts and replacement hardware.
It includes both a customer storefront and an admin operations surface.

## Main Customer Flows

- browse and search the product catalog
- view product details, stock, and pricing
- add items to cart
- select a delivery location with map-assisted address capture
- fetch live courier options before payment
- place orders through Razorpay or eligible COD
- review account history and order tracking

## Main Admin Flows

- manage catalog entries, pricing, stock, and product media
- manage coupons, featured merchandising, and user roles
- review support questions and stock notification events
- update order lifecycle state, cancellations, returns, and refunds
- create and manage Shiprocket fulfillment, AWB, pickup, labels, and tracking

## Frontend Stack

- Svelte 5
- SvelteKit 2
- Vite
- Tailwind CSS v4
- Supabase JavaScript client

## Backend and Integrations

- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Function API in `supabase/functions/api`
- Razorpay for payments
- Shiprocket for logistics
- Ola Maps for address search, reverse geocoding, and delivery estimation

## Current Repo Shape

```text
lapkart/
|-- src/
|   |-- lib/
|   |   |-- components/
|   |   |   |-- admin/
|   |   |-- supabase/
|   |-- routes/
|   |   |-- admin/
|   |   |-- order/[id]/
|   |   |-- product/[id]/
|-- static/
|-- supabase/
|   |-- functions/api/
|   |-- migrations/
|-- api/
|-- public/
|-- scripts/
|-- AGENTS.md
|-- MIGRATION_STATUS.md
|-- package.json
|-- svelte.config.js
|-- vite.config.ts
|-- vercel.json
```

## Important Routes

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

## Operational Notes

- The active frontend is the SvelteKit app at the repo root.
- `api/` is still present for deployment/server compatibility, but the application logic is centered on the Supabase-backed API surface.
- Use `npm run check` as the primary migration validation command.
- On this Windows machine, `npm run build` may still hit a Vercel adapter `EPERM` symlink error after successful client/server compilation.
