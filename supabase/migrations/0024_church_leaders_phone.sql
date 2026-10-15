-- ============================================
-- 0024_church_leaders_phone.sql
-- ============================================
-- Leaders can be reached by phone for easy contact. Optional, like the email.
-- Idempotent so it is safe whether or not 0023 already created the column.

ALTER TABLE public.church_leaders
  ADD COLUMN IF NOT EXISTS phone TEXT;