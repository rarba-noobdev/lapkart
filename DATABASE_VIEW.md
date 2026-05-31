# Database Setup and Viewing

Apply these Supabase SQL migrations in order from `supabase/migrations`:

1. Existing project migrations.
2. `202605300001_lapkart_ai_schema.sql`
3. `202605300002_storage_buckets.sql`
4. `202605310001_component_detections.sql`

## Main Table

Open Supabase Dashboard -> Table Editor -> `component_detections`.

Important fields:

- `image_url`
- `component_name`
- `category`
- `brand`
- `model_number`
- `specifications`
- `condition`
- `confidence_score`
- `ocr_text`
- `tags`
- `keywords`
- `compatible_models`
- `similar_products`
- `product_title`
- `product_description`
- `status`
- `product_id`

## Storage

Open Supabase Dashboard -> Storage -> `product-images`.

The module stores files in:

- `uploads/products/`
- `uploads/components/`
- `uploads/vendors/`

## Quick SQL View

```sql
select
  id,
  component_name,
  category,
  brand,
  model_number,
  confidence_score,
  status,
  image_url,
  created_at
from public.component_detections
order by created_at desc;
```

## API Endpoints

- `POST /components/detect`
- `PATCH /components/detections/:id`
- `POST /components/detections/:id/create-product`
- `GET /components/detections`
