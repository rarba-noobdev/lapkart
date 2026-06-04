# LapKart Ecommerce Feature Tracker

This file tracks missing ecommerce features, why they matter, and implementation status. Keep it updated as features move from research to shipped code.

## Research Summary

LapKart already has the hard foundation: auth, role-based admin, catalog CRUD, Razorpay checkout, Ola Maps delivery selection, Shiprocket shipment creation, order tracking, and Supabase Realtime. The gaps are now mostly ecommerce trust, self-service, discovery, and admin workflow features.

Research-backed priorities:

- Product discovery must have faceted filters, visible applied filters, counts, and sorting. Baymard notes that filtering is foundational for helping users narrow large catalogs and that weak filters cause abandonment.
- Checkout and post-order flows must make costs, delivery dates, cancellation rules, return rules, and refund state clear before and after payment.
- Cancellation should be state-aware. Shopify's order management docs distinguish cancellation from archive/delete and tie cancellation behavior to fulfillment/payment state.
- Returns should be a workflow, not just a label. Shiprocket describes return processing as buyer request, seller decision, reverse shipment, pickup, tracking, warehouse acknowledgement, refund, and restock.
- Refunds need gateway integration. Razorpay refunds can be created only for captured payments and may be full or partial.
- Product pages should expose shipping and return policy data clearly. Google Search Central recommends product structured data and ecommerce policy data such as shipping details and merchant return policy.

Sources:

- Baymard ecommerce filter UX: https://baymard.com/learn/ecommerce-filter-ui
- Baymard checkout UX: https://baymard.com/learn/checkout-flow-ux-optimization
- Shopify canceling orders: https://help.shopify.com/en/manual/fulfillment/managing-orders/canceling-orders
- Shopify refunding orders: https://help.shopify.com/en/manual/fulfillment/managing-orders/refunding-orders
- Shiprocket returns FAQ/support: https://www.shiprocket.in/faq/ and https://support.shiprocket.in/support/solutions/articles/152000000719-how-does-the-return-process-work-
- Razorpay refunds API: https://razorpay.com/docs/api/refunds
- Google product structured data: https://developers.google.com/search/docs/appearance/structured-data/product

## Current Priority Queue

| Priority | Feature | Customer Value | Admin Value | Status |
| --- | --- | --- | --- | --- |
| P0 | Product filters and sort | Finds the right part faster | Fewer support questions | Shipped |
| P0 | Order cancellation request flow | Self-service cancellation before shipment | Admin approve/reject and stop fulfillment | Shipped |
| P0 | Return request flow | Clear post-delivery return path | Admin decision, reverse pickup, refund/restock | Shipped, reverse pickup automation pending |
| P0 | Refund records and Razorpay refund action | Transparent refund status | Safer refund audit trail | Shipped |
| P1 | Public policy pages | Trust and Razorpay review readiness | Lower compliance friction | Shipped |
| P1 | Product structured data | Better SEO/merchant eligibility | Cleaner catalog metadata | Shipped |
| P1 | Wishlist/save for later | Easier repeat shopping | Intent signal | Shipped |
| P1 | Product reviews/questions | Trust and compatibility validation | User feedback loop | Shipped |
| P1 | Low stock/back-in-stock notifications | Prevents dead ends | Demand capture | Capture + admin outbox shipped, external email/WhatsApp delivery pending |
| P1 | Authenticity, condition, GST, and DOA metadata | Shows trust and invoice readiness before checkout | Keeps SKU data consistent | Shipped |
| P1 | Guardrailed COD | Reduces first-buyer friction | Controls RTO risk | Shipped for Chennai/capped eligible products |
| P1 | Pro buyer account lite | GST/shop details for repeat buyers | Business buyer visibility | Shipped |
| P2 | Delivery promise without hubs | Clear checkout ETA using current single-origin flow | Avoids impossible hub promises | Shipped |
| P2 | Coupons/promotions | Conversion and retention | Campaign control | Shipped |
| P2 | Bulk admin fulfillment actions | Faster packing and dispatch | Less repeated clicking | Partially present |
| P2 | Invoice download | Buyer trust/accounting | Support reduction | Shipped |

## Implementation Notes

### Product Filters And Sort

Minimum scope:

- Category
- Brand
- Price range
- Stock availability
- Minimum rating
- Sort by relevance, newest, price, rating, discount
- Applied filter chips
- Reset filters

Shipped:

- URL-backed filters on `/products`
- Desktop filter sidebar
- Brand, price, stock, rating, category, and sort controls
- Applied filter chips with one-click removal
- Clear all action
- Browser back/forward and shareable filtered URLs

### Order Cancellation

Minimum scope:

- Add `order_cancellation_requests` table.
- Customer can request cancellation only for paid orders that are not shipped/delivered/cancelled.
- Admin can approve or reject.
- Approval sets order status to `cancelled`, blocks shipment creation, and creates/refers to refund workflow.
- If shipment already exists, admin must cancel Shiprocket shipment or reject with reason.

Shipped:

- Supabase tables, RLS, and Realtime for `order_cancellation_requests`, `refunds`, and `order_invoices`.
- Customer order detail can request cancellation while eligible.
- Admin order workflow can approve/reject cancellation and trigger Razorpay refund.
- Shipment creation is blocked for cancelled/cancellation-requested orders.

### Returns

Minimum scope:

- Add `return_requests` and `return_request_items`.
- Customer can request return only after delivery and inside policy window.
- Capture reason, photos, selected items, condition notes.
- Admin can approve/reject.
- Approval creates reverse shipment flow through Shiprocket when available.
- Warehouse receipt marks item received, then refund/restock decision is recorded.

Shipped:

- Supabase `return_requests` and `return_request_items` with RLS and Realtime.
- Customer order detail can request returns for delivered orders inside the policy window.
- Admin order workflow can approve/reject/mark received and trigger refund.
- Reverse Shiprocket pickup creation is still pending because it needs final Shiprocket return-order API mapping and pickup policy confirmation.

### Refunds

Minimum scope:

- Add `refunds` table linked to order/payment/return/cancellation.
- Admin action calls Razorpay refund API.
- Store provider refund id, amount, status, reason, and raw payload.
- Realtime updates customer order detail and admin orders.

Shipped:

- `refunds` table with provider payload and linkage to cancellation/return requests.
- Admin refund action calls Razorpay refunds API with server-side credentials.
- Customer order detail shows refund status in realtime.

### Policy Pages

Minimum scope:

- About
- Contact
- Shipping policy
- Cancellation and refunds
- Return policy
- Terms and conditions
- Privacy policy

Shipped:

- `/about`
- `/contact`
- `/shipping-policy`
- `/returns-policy`
- `/cancellation-refunds`
- `/terms`
- `/privacy`

### Promotions

Shipped:

- `coupons` and `coupon_redemptions` tables with RLS and admin controls.
- Admin Promos tab to create, edit, activate/deactivate, and inspect coupon usage.
- Checkout preview and Razorpay order creation validate coupon status, dates, minimum subtotal, global usage limits, and per-user limits server-side.
- Orders, checkout sessions, and payments store validated coupon/discount metadata.

### Invoice Download

Shipped:

- `order_invoices` table with generated invoice numbers.
- Paid checkout creates or upserts an invoice record.
- Customer order detail can open an authenticated printable invoice HTML page.

### Product Trust And Q&A

Shipped:

- Product rows now support `authenticity_grade`, `condition_grade`, `hsn_code`, `gst_rate`, `doa_policy_days`, `local_delivery_eligible`, and `cod_eligible`.
- Admin catalog editor exposes authenticity and condition as dropdowns, plus GST/HSN, DOA days, local delivery, and COD controls.
- Product detail pages show authenticity, condition, GST/HSN, DOA terms, COD eligibility, and published Q&A.
- Customers can submit product questions; admin can answer, publish, or reject them from the Support tab.

### COD And Pro Buyer Lite

Shipped:

- Checkout can create COD orders through the backend without loading Razorpay.
- COD is server-verified and restricted to Chennai-like delivery addresses, eligible products, total up to INR 4,000, and first-three COD usage.
- COD orders are stored with `payment_status = cod_pending` and can be cancelled through the admin workflow without calling Razorpay.
- Customer dashboard includes business account fields for shop name, GSTIN, phone, billing email/address, city, state, and pincode.

### Back-In-Stock Outbox

Shipped:

- Stock changes from zero to positive queue `stock_notification_events`.
- Admin Support tab lists queued events and lets operations mark them sent, failed, or cancelled.

Pending:

- External email/WhatsApp sending provider is not connected yet, so the outbox is operational but not automatically delivered.

### Delivery Promise Without Hubs

Shipped:

- Checkout summary receives a backend delivery promise based on the selected Shiprocket Quick or standard courier estimate.
- The app does not show hub-level promises because no delivery hubs exist yet.

Deferred:

- Zone/hub stock visibility, nearest-hub filtering, and SLA dashboards should wait until physical hubs or bin/location inventory actually exist.

## Rerun Inputs

workflow: firecrawl-deep-research
topic: ecommerce missing features for LapKart, a laptop-parts ecommerce app with Supabase, Razorpay, Shiprocket, and Ola Maps
depth: quick due Firecrawl hosted search credit error, with browser search fallback
output: markdown tracker plus incremental implementation
