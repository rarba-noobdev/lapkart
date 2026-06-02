# Database Setup and Viewing

Apply the Supabase SQL migrations in `supabase/migrations` in order. The latest cleanup migration removes legacy service tables and locks the role model to two roles.

## Roles

Open Supabase Dashboard -> Table Editor -> `user_roles`.

Role rules:

- Allowed values are `admin` and `user`.
- New signups are inserted as `user` by `public.handle_new_user()`.
- The app can read roles but cannot update them through client-side RLS policies.
- To make someone an admin, update their row manually in the database:

```sql
update public.user_roles
set role = 'admin'
where user_id = '<auth-user-id>';
```

## Main Tables

- `profiles`
- `user_roles`
- `products`
- `addresses`
- `orders`
- `order_items`
- `payments`
- `shipments`
- `shipment_packages`
- `shipment_events`
- `shipping_pickup_locations`
- `shipping_batches`
- `shipping_batch_items`

## Storage

Main buckets:

- `products`
- `users`

Supabase blocks direct bucket deletion from SQL, so the unused historical buckets `invoices`, `product-images`, `repair_requests`, `reviews`, and `vendors` should be removed from the Storage UI or Storage API.

## Quick SQL Checks

```sql
select user_id, role, created_at
from public.user_roles
order by created_at desc;
```

```sql
select id, title, brand, category, price, stock
from public.products
order by created_at desc;
```
