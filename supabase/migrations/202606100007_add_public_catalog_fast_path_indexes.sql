create index if not exists products_active_created_idx
on public.products (created_at desc, id)
where status = 'active';

create index if not exists products_active_category_rating_idx
on public.products (category, rating desc, reviews desc, id)
where status = 'active';

create index if not exists products_active_brand_created_idx
on public.products (brand, created_at desc, id)
where status = 'active';
