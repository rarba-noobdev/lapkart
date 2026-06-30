begin;

-- This production migration moved fuzzy matching to the index-assisted <% path.
-- The current local 20260621050101_fuzzy_synonym_product_search.sql already
-- contains the final indexed behavior, so this keeps local migration history
-- aligned with the applied remote version.

commit;
