-- ============================================
-- 0004_events.sql
-- Events, Registrations, Attendance & Posters
-- ============================================


-- ============================================
-- EXTENSIONS
-- ============================================

-- Required for:
-- gen_random_uuid()
-- gen_random_bytes()

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE event_status AS ENUM (
  'draft',
  'published',
  'cancelled',
  'completed'
);

CREATE TYPE event_visibility AS ENUM (
  'public',
  'members_only'
);


-- ============================================
-- EVENTS
-- ============================================

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,

  all_day BOOLEAN DEFAULT FALSE,

  location_name TEXT,
  address TEXT,

  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  poster_url TEXT,

  capacity INT,

  status event_status DEFAULT 'published',

  visibility event_visibility DEFAULT 'public',

  is_registration_required BOOLEAN DEFAULT FALSE,

  registration_deadline TIMESTAMPTZ,

  price NUMERIC(10, 2) DEFAULT 0,

  currency TEXT DEFAULT 'KES',

  qr_code TEXT,

  created_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(church_id, slug)
);


-- ============================================
-- EVENTS INDEXES
-- ============================================

CREATE INDEX idx_events_church_start
  ON public.events(church_id, start_time DESC);

CREATE INDEX idx_events_slug
  ON public.events(slug);

CREATE INDEX idx_events_status
  ON public.events(church_id, status);

CREATE INDEX idx_events_public
  ON public.events(visibility, status, start_time)
  WHERE visibility = 'public';


-- ============================================
-- EVENT REGISTRATIONS
-- For paid/free ticketed events
-- ============================================

CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES public.events(id)
    ON DELETE CASCADE,

  user_id UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  church_membership_id UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  guest_name TEXT,

  guest_email TEXT,

  guest_phone TEXT,

  status TEXT DEFAULT 'registered',
  -- registered | checked_in | cancelled

  payment_status TEXT DEFAULT 'pending',
  -- pending | paid | refunded | free

  payment_reference TEXT,

  amount_paid NUMERIC(10, 2),

  ticket_code TEXT UNIQUE
    DEFAULT replace(gen_random_uuid()::TEXT, '-', ''),

  checked_in_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- EVENT REGISTRATION INDEXES
-- ============================================

CREATE INDEX idx_registrations_event
  ON public.event_registrations(event_id);

CREATE INDEX idx_registrations_user
  ON public.event_registrations(user_id);

CREATE INDEX idx_registrations_ticket
  ON public.event_registrations(ticket_code);


-- ============================================
-- EVENT ATTENDANCE
-- QR scan / manual attendance
-- ============================================

CREATE TABLE public.event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES public.events(id)
    ON DELETE CASCADE,

  membership_id UUID
    REFERENCES public.church_memberships(id)
    ON DELETE CASCADE,

  registration_id UUID
    REFERENCES public.event_registrations(id)
    ON DELETE SET NULL,

  scanned_at TIMESTAMPTZ DEFAULT NOW(),

  method TEXT DEFAULT 'qr'
  -- qr | manual
);


-- ============================================
-- EVENT ATTENDANCE INDEXES
-- ============================================

CREATE INDEX idx_attendance_event
  ON public.event_attendance(event_id);

CREATE INDEX idx_attendance_member
  ON public.event_attendance(membership_id);


-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_registrations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_attendance
  ENABLE ROW LEVEL SECURITY;


-- ============================================
-- EVENTS POLICIES
-- ============================================

-- Public events can be viewed publicly.
-- Church members can view all events belonging
-- to their church.

CREATE POLICY "events_public_read"
ON public.events
FOR SELECT
USING (
  (
    visibility = 'public'
    AND status IN ('published', 'completed')
  )
  OR church_id IN (
    SELECT church_id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


-- Church admins can create events.

CREATE POLICY "events_admin_insert"
ON public.events
FOR INSERT
WITH CHECK (
  public.is_church_admin(church_id)
);


-- Church admins can update events.

CREATE POLICY "events_admin_update"
ON public.events
FOR UPDATE
USING (
  public.is_church_admin(church_id)
);


-- Only super admins can delete events.

CREATE POLICY "events_super_admin_delete"
ON public.events
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.church_memberships
    WHERE user_id = auth.uid()
      AND church_id = events.church_id
      AND role = 'super_admin'
  )
);


-- ============================================
-- EVENT REGISTRATION POLICIES
-- ============================================

-- Users can view their own registrations.
-- Church admins can view registrations for
-- events belonging to their church.

CREATE POLICY "registrations_read_own_or_admin"
ON public.event_registrations
FOR SELECT
USING (
  user_id = auth.uid()
  OR event_id IN (
    SELECT id
    FROM public.events
    WHERE public.is_church_admin(church_id)
  )
);


-- Users can register themselves.
-- Church admins can create registrations
-- on behalf of users.

CREATE POLICY "registrations_insert_self_or_admin"
ON public.event_registrations
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR event_id IN (
    SELECT id
    FROM public.events
    WHERE public.is_church_admin(church_id)
  )
);


-- Users can update their own registrations.
-- Church admins can update registrations
-- for their church.

CREATE POLICY "registrations_update_admin"
ON public.event_registrations
FOR UPDATE
USING (
  user_id = auth.uid()
  OR event_id IN (
    SELECT id
    FROM public.events
    WHERE public.is_church_admin(church_id)
  )
);


-- ============================================
-- EVENT ATTENDANCE POLICIES
-- ============================================

-- Church admins can read/write attendance.

CREATE POLICY "attendance_admin_all"
ON public.event_attendance
FOR ALL
USING (
  event_id IN (
    SELECT id
    FROM public.events
    WHERE public.is_church_admin(church_id)
  )
);


-- Members can insert attendance for themselves.

CREATE POLICY "attendance_self_insert"
ON public.event_attendance
FOR INSERT
WITH CHECK (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


-- ============================================
-- STORAGE BUCKET
-- EVENT POSTERS
-- ============================================

INSERT INTO storage.buckets (
  id,
  name,
  public
)
VALUES (
  'event-posters',
  'event-posters',
  TRUE
)
ON CONFLICT DO NOTHING;


-- ============================================
-- EVENT POSTER STORAGE POLICIES
-- ============================================

-- Anyone can view event posters because the
-- bucket is public.

CREATE POLICY "event_posters_public_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'event-posters'
);


-- Authenticated users can upload event posters.

CREATE POLICY "event_posters_admin_write"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'event-posters'
  AND auth.role() = 'authenticated'
);

