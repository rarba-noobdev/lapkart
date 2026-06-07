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
- `/profile`
- `/orders`
- `/order/[id]`
- `/admin`
- `/admin/fulfillment`

## Deployment

- GitHub repo: `rarba-noobdev/lapkart`
- Primary branch: `main`
- Vercel project: `lapkart`
- Production URL: `https://lapkart-rarba-noobdevs-projects.vercel.app`
- GitHub deployments are created by `vercel[bot]` when `main` is pushed.

## Public Runtime Configuration

The SvelteKit app imports Supabase browser config through `$env/static/public`, so these values must exist at build time for Vercel/GitHub deployments:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`

These public values are also pinned in `vercel.json` so GitHub-triggered Vercel builds do not fail when the Vercel dashboard environment table is missing or stale.

## Operational Notes

- The active frontend is the SvelteKit app at the repo root.
- `api/` is still present for deployment/server compatibility, but the application logic is centered on the Supabase-backed API surface.
- Use `npm run check` as the primary migration validation command.
- Use `npm run build` before deployment when touching route, env, or adapter configuration.
- If a GitHub deployment fails, inspect it with `npx vercel inspect <deployment-id-or-url> --logs`.
- A missing export error from `virtual:env/static/public` means a required public build-time env var is not available to Vercel.
