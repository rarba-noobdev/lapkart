# LAPKART AI Architecture

LAPKART AI is structured as a Vite React marketplace frontend plus a Node/Express API and Supabase backend.

## Frontend

- React, TypeScript, TailwindCSS, Framer Motion, ShadCN UI primitives.
- Public catalog, product pages, cart, checkout, customer dashboard, vendor dashboard, delivery partner panel, repair service, and admin command center.
- Supabase Auth supports Google, GitHub, email OTP, and phone OTP when enabled in the Supabase project.

## Backend

- `api/src/server.ts` exposes production API contracts for AI product detection, product copy generation, fraud scoring, Razorpay orders, Razorpay signature verification, Supabase Storage uploads, and admin analytics.
- `api/src/ai.ts` centralizes OpenAI, Gemini, and HuggingFace integration points.
- `api/src/payments.ts` centralizes Razorpay order creation and verification.

## Supabase

- Migrations create users, products, categories, orders, payments, vendors, delivery partners, reviews, repair requests, wishlists, carts, notifications, AI predictions, invoices, and storage buckets.
- `component_detections` stores AI Vision/OCR outputs, editable marketplace metadata, compatibility hints, similar product matches, and product creation status.
- Storage buckets: `products`, `users`, `vendors`, `invoices`, `reviews`, `repair_requests`.
- Component images use `product-images/uploads/products`, `product-images/uploads/components`, and `product-images/uploads/vendors`.
- RLS policies restrict customer data to owners, allow public active product/category reads, and allow admin/super admin operational access.

## Deployment

- Frontend: Vercel using `vercel.json`.
- API: Render using `render.yaml`.
- Container: `Dockerfile` builds the API runtime and can be extended for a reverse proxy if both services need one image.

## Required Secrets

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`

API:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `HUGGINGFACE_API_KEY`
