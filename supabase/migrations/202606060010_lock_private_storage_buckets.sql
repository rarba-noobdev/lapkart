-- Bucket-level exposure tightening that can be applied through the project migration role.
-- Object policy replacement is documented in supabase/manual_storage_hardening.sql because
-- storage.objects policy DDL requires relation-owner privileges in this project.

update storage.buckets
set public = false
where id in ('users', 'vendors', 'invoices', 'repair_requests');

update storage.buckets
set public = true
where id in ('products', 'product-images', 'reviews');
