begin;

-- This production migration narrowed fuzzy matching to the title + brand
-- expression. The current local 20260621050101_fuzzy_synonym_product_search.sql
-- already contains that final function/index shape, so this is a history marker
-- matching the remote Supabase migration version.

commit;
