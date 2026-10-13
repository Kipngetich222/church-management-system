-- ============================================
-- 0015_rename_church_slug_to_username.sql
-- ============================================
--
-- The church's unique public identifier was stored in a column called `slug`,
-- but the product (UI, API, docs) consistently calls it the church username.
-- Rename the column so the database matches the domain language.
--
-- Only public.churches is touched here; public.events.slug is unrelated and
-- stays as-is.

ALTER TABLE public.churches RENAME COLUMN slug TO username;

-- Keep the supporting index / unique constraint names in sync with the column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_churches_slug' AND n.nspname = 'public'
  ) THEN
    ALTER INDEX public.idx_churches_slug RENAME TO idx_churches_username;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'churches_slug_key'
      AND conrelid = 'public.churches'::regclass
  ) THEN
    ALTER TABLE public.churches
      RENAME CONSTRAINT churches_slug_key TO churches_username_key;
  END IF;
END $$;
