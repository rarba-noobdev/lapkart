insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create table if not exists public.component_detections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  image_url text not null,
  component_name text not null,
  category text not null,
  brand text,
  model_number text,
  specifications jsonb not null default '{}',
  condition text,
  confidence_score numeric(5,2),
  ocr_text text,
  tags text[] not null default '{}',
  keywords text[] not null default '{}',
  compatible_models text[] not null default '{}',
  similar_products text[] not null default '{}',
  product_title text,
  product_description text,
  seo_tags text[] not null default '{}',
  status text not null default 'draft',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.component_detections enable row level security;

create index if not exists component_detections_user_idx on public.component_detections(user_id);
create index if not exists component_detections_category_idx on public.component_detections(category);
create index if not exists component_detections_status_idx on public.component_detections(status);
create index if not exists component_detections_tags_idx on public.component_detections using gin(tags);

drop policy if exists "component detections owner read" on public.component_detections;
drop policy if exists "component detections owner insert" on public.component_detections;
drop policy if exists "component detections owner update" on public.component_detections;
drop policy if exists "component detections admin all" on public.component_detections;

create policy "component detections owner read"
on public.component_detections for select
using (user_id = auth.uid());

create policy "component detections owner insert"
on public.component_detections for insert
with check (user_id = auth.uid() or user_id is null);

create policy "component detections owner update"
on public.component_detections for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "component detections admin all"
on public.component_detections for all
using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "product-images public read component module" on storage.objects;
drop policy if exists "product-images authenticated upload component module" on storage.objects;

create policy "product-images public read component module"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product-images authenticated upload component module"
on storage.objects for insert
with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
