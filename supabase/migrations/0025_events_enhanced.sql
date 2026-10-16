-- ============================================
-- 0025_events_enhanced.sql
-- Physical / online events, payment details and richer audience targeting.
--
-- NOTE: the new enum values added here are used by the visibility policy in
-- 0026_events_visibility_policy.sql. They are kept in a separate migration
-- because PostgreSQL forbids using a freshly added enum value in the same
-- transaction that added it.
-- ============================================

-- --------------------------------------------
-- EVENT TYPE (physical vs online)
-- --------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT;

-- --------------------------------------------
-- PAYMENT DETAILS (paid / ticketed events)
-- --------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_account TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- --------------------------------------------
-- AUDIENCE TARGETING COLUMNS
-- --------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility_department_id UUID
    REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility_group_id UUID
    REFERENCES public.small_groups(id) ON DELETE SET NULL;

-- Constraints (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_type_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_type_check
      CHECK (event_type IN ('physical', 'online'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_payment_method_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_payment_method_check
      CHECK (
        payment_method IS NULL
        OR payment_method IN ('free', 'till', 'paybill', 'phone')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_events_visibility_department
  ON public.events(visibility_department_id);

CREATE INDEX IF NOT EXISTS idx_events_visibility_group
  ON public.events(visibility_group_id);

-- --------------------------------------------
-- MORE VISIBILITY AUDIENCES
-- --------------------------------------------
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'all_members';
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'super_admins';
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'department';
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'group';
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'men';
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'women';
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'youth';
