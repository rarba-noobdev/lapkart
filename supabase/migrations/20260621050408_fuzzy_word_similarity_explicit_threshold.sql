begin;

-- This production migration was applied as a narrow fuzzy-search tuning step.
-- The current local 20260621050101_fuzzy_synonym_product_search.sql already
-- includes the final indexed word-similarity behavior, so this file preserves
-- the recorded Supabase migration version for future migration tooling.

commit;
