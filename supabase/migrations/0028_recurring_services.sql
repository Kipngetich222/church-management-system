-- ============================================
-- 0028_recurring_services.sql
-- Recurring "special" services (Sunday / Saturday services and friends).
--
-- These are the services that always exist. An admin describes the service
-- once (which weekday, the service times, the order of service) and the
-- calendar expands every occurrence, so there is no need to create a one-off
-- event for each Sunday. Only the programme changes week to week, and that is
-- uploaded per occurrence as a PDF.
--
-- This migration is idempotent so it can be re-run safely after a partial
-- apply.
-- ============================================

-- --------------------------------------------
-- RECURRING SERVICES
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  -- Nature / order of service.
  procedure TEXT,

  -- 0 = Sunday ... 6 = Saturday.
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- [{ "label": "1st Service", "start": "08:00", "end": "10:00" }, ...]
  times JSONB NOT NULL DEFAULT '[]'::jsonb,

  location_name TEXT,
  address TEXT,

  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',

  visibility public.event_visibility NOT NULL DEFAULT 'members_only',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  start_date DATE,
  end_date DATE,

  qr_code TEXT,

  created_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_services_church
  ON public.recurring_services(church_id, day_of_week);


-- --------------------------------------------
-- SERVICE PROGRAMMES (per occurrence, PDF)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  recurring_service_id UUID NOT NULL
    REFERENCES public.recurring_services(id)
    ON DELETE CASCADE,

  service_date DATE NOT NULL,
  title TEXT,
  notes TEXT,

  file_url TEXT,
  file_name TEXT,

  uploaded_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (recurring_service_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_service_programmes_church
  ON public.service_programmes(church_id, service_date DESC);


-- --------------------------------------------
-- SERVICE ATTENDANCE (per occurrence)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  recurring_service_id UUID NOT NULL
    REFERENCES public.recurring_services(id)
    ON DELETE CASCADE,

  service_date DATE NOT NULL,

  membership_id UUID NOT NULL
    REFERENCES public.church_memberships(id)
    ON DELETE CASCADE,

  method TEXT NOT NULL DEFAULT 'qr',
  scanned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (recurring_service_id, service_date, membership_id)
);

CREATE INDEX IF NOT EXISTS idx_service_attendance_service
  ON public.service_attendance(recurring_service_id, service_date);

CREATE INDEX IF NOT EXISTS idx_service_attendance_member
  ON public.service_attendance(membership_id);


-- --------------------------------------------
-- updated_at trigger
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_recurring_services()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recurring_services_touch ON public.recurring_services;
CREATE TRIGGER trg_recurring_services_touch
BEFORE UPDATE ON public.recurring_services
FOR EACH ROW
EXECUTE FUNCTION public.touch_recurring_services();


-- --------------------------------------------
-- CHECK-IN WINDOW
-- Members may only check in on (or after) the service day. Admins recording
-- attendance manually and service-role jobs are not bound by the window.
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_service_checkin_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc public.recurring_services%ROWTYPE;
BEGIN
  SELECT * INTO svc FROM public.recurring_services WHERE id = NEW.recurring_service_id;

  IF svc.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' OR public.is_church_admin(svc.church_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.service_date > (NOW() AT TIME ZONE svc.timezone)::date THEN
    RAISE EXCEPTION 'Check-in opens on the day of the service'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_attendance_window ON public.service_attendance;
CREATE TRIGGER trg_service_attendance_window
BEFORE INSERT ON public.service_attendance
FOR EACH ROW
EXECUTE FUNCTION public.enforce_service_checkin_window();


-- --------------------------------------------
-- ROW LEVEL SECURITY
-- --------------------------------------------
ALTER TABLE public.recurring_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_attendance ENABLE ROW LEVEL SECURITY;

-- Recurring services: admins manage; members read their church's services;
-- public services are readable by anyone.
DROP POLICY IF EXISTS "recurring_services_read" ON public.recurring_services;
CREATE POLICY "recurring_services_read"
ON public.recurring_services
FOR SELECT
USING (
  public.is_church_admin(church_id)
  OR (
    is_active
    AND visibility = 'public'
  )
  OR (
    is_active
    AND visibility IN ('members_only', 'all_members')
    AND church_id IN (
      SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "recurring_services_admin_write" ON public.recurring_services;
CREATE POLICY "recurring_services_admin_write"
ON public.recurring_services
FOR ALL
USING (public.is_church_admin(church_id))
WITH CHECK (public.is_church_admin(church_id));

-- Programmes: admins manage; members of the church can read.
DROP POLICY IF EXISTS "service_programmes_read" ON public.service_programmes;
CREATE POLICY "service_programmes_read"
ON public.service_programmes
FOR SELECT
USING (
  public.is_church_admin(church_id)
  OR church_id IN (
    SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "service_programmes_admin_write" ON public.service_programmes;
CREATE POLICY "service_programmes_admin_write"
ON public.service_programmes
FOR ALL
USING (public.is_church_admin(church_id))
WITH CHECK (public.is_church_admin(church_id));

-- Attendance: admins manage; members insert and read their own.
DROP POLICY IF EXISTS "service_attendance_admin_all" ON public.service_attendance;
CREATE POLICY "service_attendance_admin_all"
ON public.service_attendance
FOR ALL
USING (public.is_church_admin(church_id))
WITH CHECK (public.is_church_admin(church_id));

DROP POLICY IF EXISTS "service_attendance_self_insert" ON public.service_attendance;
CREATE POLICY "service_attendance_self_insert"
ON public.service_attendance
FOR INSERT
WITH CHECK (
  membership_id IN (
    SELECT id FROM public.church_memberships WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "service_attendance_self_read" ON public.service_attendance;
CREATE POLICY "service_attendance_self_read"
ON public.service_attendance
FOR SELECT
USING (
  membership_id IN (
    SELECT id FROM public.church_memberships WHERE user_id = auth.uid()
  )
);


-- --------------------------------------------
-- STORAGE: service programmes (PDF)
-- --------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-programmes', 'service-programmes', TRUE)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "service_programmes_public_read" ON storage.objects;
CREATE POLICY "service_programmes_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'service-programmes');

DROP POLICY IF EXISTS "service_programmes_auth_write" ON storage.objects;
CREATE POLICY "service_programmes_auth_write"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'service-programmes'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "service_programmes_auth_update" ON storage.objects;
CREATE POLICY "service_programmes_auth_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'service-programmes'
  AND auth.role() = 'authenticated'
);