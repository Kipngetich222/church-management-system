-- ============================================
-- 0029_service_exceptions.sql
-- Hide a single occurrence of a recurring service.
--
-- A recurring service happens every week, but occasionally a specific day is
-- cancelled (a special event, a holiday, a one-off change). Rather than
-- deleting the whole service or faking an event, an admin hides that one date
-- and the calendars simply skip it.
--
-- This migration is idempotent so it can be re-run safely after a partial
-- apply.
-- ============================================

CREATE TABLE IF NOT EXISTS public.service_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  recurring_service_id UUID NOT NULL
    REFERENCES public.recurring_services(id)
    ON DELETE CASCADE,

  -- The occurrence that does NOT happen (0-based weekday is on the service).
  service_date DATE NOT NULL,

  reason TEXT,

  created_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (recurring_service_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_service_exceptions_service
  ON public.service_exceptions(recurring_service_id, service_date);

CREATE INDEX IF NOT EXISTS idx_service_exceptions_church
  ON public.service_exceptions(church_id, service_date);


-- --------------------------------------------
-- ROW LEVEL SECURITY
-- --------------------------------------------
ALTER TABLE public.service_exceptions ENABLE ROW LEVEL SECURITY;

-- Admins manage the hidden days.
DROP POLICY IF EXISTS "service_exceptions_admin_write" ON public.service_exceptions;
CREATE POLICY "service_exceptions_admin_write"
ON public.service_exceptions
FOR ALL
USING (public.is_church_admin(church_id))
WITH CHECK (public.is_church_admin(church_id));

-- Members of the church can read them so their calendar skips the hidden day.
DROP POLICY IF EXISTS "service_exceptions_read" ON public.service_exceptions;
CREATE POLICY "service_exceptions_read"
ON public.service_exceptions
FOR SELECT
USING (
  public.is_church_admin(church_id)
  OR church_id IN (
    SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
  )
);
