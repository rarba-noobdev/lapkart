alter table public.products
  add column if not exists specifications jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_specifications_object_chk;

alter table public.products
  add constraint products_specifications_object_chk
  check (jsonb_typeof(specifications) = 'object');

comment on column public.products.specifications is
  'Structured product specification label/value pairs for detail pages.';
