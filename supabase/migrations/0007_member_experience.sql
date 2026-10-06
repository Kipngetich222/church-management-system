
-- ============================================
-- 0007_member_experience.sql
-- Member Experience:
-- Prayer Requests, Pastoral Care, Sermons,
-- Volunteers, Resource Booking, Visitors,
-- Advanced RBAC & Permissions
-- ============================================


-- ============================================
-- PRAYER REQUESTS & COUNSELING
-- ============================================

CREATE TYPE prayer_request_type AS ENUM (
  'prayer',
  'counseling'
);

CREATE TYPE prayer_request_status AS ENUM (
  'open',
  'in_progress',
  'closed',
  'answered'
);

CREATE TYPE prayer_visibility AS ENUM (
  'private',
  'pastors_only',
  'public_anonymous',
  'public_named'
);


CREATE TABLE public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  membership_id UUID NOT NULL
    REFERENCES public.church_memberships(id)
    ON DELETE CASCADE,

  type prayer_request_type NOT NULL DEFAULT 'prayer',

  category TEXT,
  -- e.g. 'health', 'finances', 'family'

  title TEXT NOT NULL,

  body TEXT NOT NULL,

  visibility prayer_visibility NOT NULL DEFAULT 'pastors_only',

  status prayer_request_status NOT NULL DEFAULT 'open',

  assigned_to UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_prayer_church
  ON public.prayer_requests(church_id, created_at DESC);

CREATE INDEX idx_prayer_status
  ON public.prayer_requests(church_id, status);


-- ============================================
-- PRAYER INTERACTIONS
-- Pastoral notes / responses
-- ============================================

CREATE TABLE public.prayer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id UUID NOT NULL
    REFERENCES public.prayer_requests(id)
    ON DELETE CASCADE,

  author_membership_id UUID NOT NULL
    REFERENCES public.church_memberships(id)
    ON DELETE CASCADE,

  body TEXT NOT NULL,

  is_internal BOOLEAN DEFAULT FALSE,
  -- TRUE = only pastors see it

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_prayer_interactions_request
  ON public.prayer_interactions(request_id);


-- ============================================
-- PASTORAL CARE NOTES
-- ============================================

CREATE TABLE public.pastoral_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  membership_id UUID NOT NULL
    REFERENCES public.church_memberships(id)
    ON DELETE CASCADE,

  author_membership_id UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  body TEXT NOT NULL,

  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_pastoral_notes_member
  ON public.pastoral_notes(membership_id);


-- ============================================
-- SERMONS
-- YouTube-backed library
-- ============================================

CREATE TABLE public.sermons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  title TEXT NOT NULL,

  speaker TEXT,

  description TEXT,

  youtube_id TEXT NOT NULL,
  -- e.g. "dQw4w9WgXcQ"

  thumbnail_url TEXT,
  -- optional override

  duration_seconds INT,

  series TEXT,

  scripture_ref TEXT,

  preached_at DATE NOT NULL,

  tags TEXT[] DEFAULT '{}',

  published BOOLEAN DEFAULT TRUE,

  created_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_sermons_church
  ON public.sermons(church_id, preached_at DESC);

CREATE INDEX idx_sermons_published
  ON public.sermons(church_id, published);


-- ============================================
-- VOLUNTEER ROLES & SCHEDULES
-- ============================================

CREATE TABLE public.volunteer_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  description TEXT,

  color TEXT DEFAULT '#6366f1',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(church_id, name)
);


CREATE TABLE public.volunteer_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  role_id UUID
    REFERENCES public.volunteer_roles(id)
    ON DELETE SET NULL,

  title TEXT NOT NULL,

  starts_at TIMESTAMPTZ NOT NULL,

  ends_at TIMESTAMPTZ NOT NULL,

  location TEXT,

  slots INT NOT NULL DEFAULT 1,

  notes TEXT,

  event_id UUID
    REFERENCES public.events(id)
    ON DELETE SET NULL,

  created_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_volunteer_shifts_church
  ON public.volunteer_shifts(church_id, starts_at);


CREATE TABLE public.volunteer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  shift_id UUID NOT NULL
    REFERENCES public.volunteer_shifts(id)
    ON DELETE CASCADE,

  membership_id UUID NOT NULL
    REFERENCES public.church_memberships(id)
    ON DELETE CASCADE,

  status TEXT DEFAULT 'confirmed',
  -- confirmed | waitlist | cancelled

  signed_up_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(shift_id, membership_id)
);


-- ============================================
-- RESOURCE BOOKING
-- ============================================

CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  type TEXT NOT NULL,
  -- room | vehicle | equipment | other

  capacity INT,

  location TEXT,

  description TEXT,

  active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE public.resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  resource_id UUID NOT NULL
    REFERENCES public.resources(id)
    ON DELETE CASCADE,

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  membership_id UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  title TEXT NOT NULL,

  purpose TEXT,

  starts_at TIMESTAMPTZ NOT NULL,

  ends_at TIMESTAMPTZ NOT NULL,

  status TEXT DEFAULT 'pending',
  -- pending | approved | rejected | cancelled

  approved_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_resource_bookings_resource
  ON public.resource_bookings(resource_id, starts_at);


-- ============================================
-- VISITOR FOLLOW-UP
-- ============================================

CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  full_name TEXT NOT NULL,

  phone TEXT,

  email TEXT,

  first_visit_date DATE DEFAULT CURRENT_DATE,

  invited_by_membership_id UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  notes TEXT,

  status TEXT DEFAULT 'new',
  -- new | contacted | follow_up | converted | cold

  assigned_to UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX idx_visitors_church
  ON public.visitors(church_id, status);


CREATE TABLE public.visitor_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  visitor_id UUID NOT NULL
    REFERENCES public.visitors(id)
    ON DELETE CASCADE,

  author_membership_id UUID
    REFERENCES public.church_memberships(id)
    ON DELETE SET NULL,

  method TEXT,
  -- call | sms | email | visit | in_person

  notes TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- ADVANCED RBAC — PERMISSIONS
-- ============================================

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  church_id UUID NOT NULL
    REFERENCES public.churches(id)
    ON DELETE CASCADE,

  role TEXT NOT NULL,
  -- super_admin | dept_admin | member | custom:<name>

  permissions TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(church_id, role)
);


-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.prayer_requests
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.prayer_interactions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pastoral_notes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sermons
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.volunteer_roles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.volunteer_shifts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.volunteer_signups
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.resources
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.resource_bookings
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.visitors
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.visitor_followups
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_permissions
  ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PRAYER REQUEST POLICIES
-- ============================================

CREATE POLICY "prayer_req_owner_or_admin"
ON public.prayer_requests
FOR SELECT
USING (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR public.is_church_admin(church_id)
  OR visibility = 'public_anonymous'
  OR visibility = 'public_named'
);


CREATE POLICY "prayer_req_insert_self"
ON public.prayer_requests
FOR INSERT
WITH CHECK (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


CREATE POLICY "prayer_req_update_owner_or_admin"
ON public.prayer_requests
FOR UPDATE
USING (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR public.is_church_admin(church_id)
);


-- ============================================
-- PRAYER INTERACTION POLICIES
-- ============================================

CREATE POLICY "prayer_interactions_read"
ON public.prayer_interactions
FOR SELECT
USING (
  (
    is_internal = FALSE
    AND request_id IN (
      SELECT id
      FROM public.prayer_requests
      WHERE membership_id IN (
        SELECT id
        FROM public.church_memberships
        WHERE user_id = auth.uid()
      )
      OR public.is_church_admin(church_id)
    )
  )
  OR public.is_church_admin(
    (
      SELECT church_id
      FROM public.prayer_requests
      WHERE id = request_id
    )
  )
);


CREATE POLICY "prayer_interactions_write"
ON public.prayer_interactions
FOR INSERT
WITH CHECK (
  author_membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


-- ============================================
-- PASTORAL NOTES POLICIES
-- ============================================

CREATE POLICY "pastoral_notes_admin"
ON public.pastoral_notes
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


-- ============================================
-- SERMON POLICIES
-- ============================================

CREATE POLICY "sermons_read"
ON public.sermons
FOR SELECT
USING (
  (
    published = TRUE
    AND church_id IN (
      SELECT church_id
      FROM public.church_memberships
      WHERE user_id = auth.uid()
    )
  )
  OR public.is_church_admin(church_id)
);


CREATE POLICY "sermons_admin_write"
ON public.sermons
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


-- ============================================
-- VOLUNTEER POLICIES
-- ============================================

CREATE POLICY "vol_roles_read"
ON public.volunteer_roles
FOR SELECT
USING (
  church_id IN (
    SELECT church_id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


CREATE POLICY "vol_roles_admin_write"
ON public.volunteer_roles
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


CREATE POLICY "vol_shifts_read"
ON public.volunteer_shifts
FOR SELECT
USING (
  church_id IN (
    SELECT church_id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


CREATE POLICY "vol_shifts_admin_write"
ON public.volunteer_shifts
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


CREATE POLICY "vol_signups_read"
ON public.volunteer_signups
FOR SELECT
USING (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR shift_id IN (
    SELECT id
    FROM public.volunteer_shifts
    WHERE public.is_church_admin(church_id)
  )
);


CREATE POLICY "vol_signups_self_write"
ON public.volunteer_signups
FOR INSERT
WITH CHECK (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


CREATE POLICY "vol_signups_self_delete"
ON public.volunteer_signups
FOR DELETE
USING (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR shift_id IN (
    SELECT id
    FROM public.volunteer_shifts
    WHERE public.is_church_admin(church_id)
  )
);


-- ============================================
-- RESOURCE POLICIES
-- ============================================

CREATE POLICY "resources_read"
ON public.resources
FOR SELECT
USING (
  church_id IN (
    SELECT church_id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
);


CREATE POLICY "resources_admin_write"
ON public.resources
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


CREATE POLICY "bookings_read_own_or_admin"
ON public.resource_bookings
FOR SELECT
USING (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR public.is_church_admin(church_id)
);


CREATE POLICY "bookings_self_insert"
ON public.resource_bookings
FOR INSERT
WITH CHECK (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR public.is_church_admin(church_id)
);


CREATE POLICY "bookings_admin_update"
ON public.resource_bookings
FOR UPDATE
USING (
  public.is_church_admin(church_id)
);


-- ============================================
-- VISITOR POLICIES
-- ============================================

CREATE POLICY "visitors_admin"
ON public.visitors
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


CREATE POLICY "visitor_followups_admin"
ON public.visitor_followups
FOR ALL
USING (
  visitor_id IN (
    SELECT id
    FROM public.visitors
    WHERE public.is_church_admin(church_id)
  )
);


-- ============================================
-- ROLE PERMISSIONS POLICIES
-- ============================================

CREATE POLICY "role_perms_admin"
ON public.role_permissions
FOR ALL
USING (
  public.is_church_admin(church_id)
)
WITH CHECK (
  public.is_church_admin(church_id)
);


-- ============================================
-- SEED DEFAULT ROLE PERMISSIONS
-- ============================================

INSERT INTO public.role_permissions (
  church_id,
  role,
  permissions
)
SELECT
  id,
  'super_admin',
  ARRAY[
    'members:*',
    'finance:*',
    'events:*',
    'departments:*',
    'church:*',
    'sms:*',
    'prayer:*',
    'pastoral:*',
    'sermons:*',
    'volunteers:*',
    'visitors:*',
    'resources:*',
    'settings:*',
    'analytics:*',
    'reports:*'
  ]
FROM public.churches
ON CONFLICT DO NOTHING;


INSERT INTO public.role_permissions (
  church_id,
  role,
  permissions
)
SELECT
  id,
  'dept_admin',
  ARRAY[
    'members:read',
    'events:read',
    'events:write',
    'sms:department',
    'attendance:read',
    'volunteers:read',
    'prayer:read'
  ]
FROM public.churches
ON CONFLICT DO NOTHING;


INSERT INTO public.role_permissions (
  church_id,
  role,
  permissions
)
SELECT
  id,
  'member',
  ARRAY[
    'profile:own',
    'events:read',
    'giving:create',
    'prayer:create',
    'volunteers:signup',
    'resources:book',
    'sermons:read'
  ]
FROM public.churches
ON CONFLICT DO NOTHING;


-- ============================================
-- AUTOMATIC ROLE PERMISSION SEEDING
-- FOR NEW CHURCHES
-- ============================================

CREATE OR REPLACE FUNCTION public.seed_church_permissions()
RETURNS TRIGGER AS $$
BEGIN

  INSERT INTO public.role_permissions (
    church_id,
    role,
    permissions
  )
  VALUES

  (
    NEW.id,
    'super_admin',
    ARRAY[
      'members:*',
      'finance:*',
      'events:*',
      'departments:*',
      'church:*',
      'sms:*',
      'prayer:*',
      'pastoral:*',
      'sermons:*',
      'volunteers:*',
      'visitors:*',
      'resources:*',
      'settings:*',
      'analytics:*',
      'reports:*'
    ]
  ),

  (
    NEW.id,
    'dept_admin',
    ARRAY[
      'members:read',
      'events:read',
      'events:write',
      'sms:department',
      'attendance:read',
      'volunteers:read',
      'prayer:read'
    ]
  ),

  (
    NEW.id,
    'member',
    ARRAY[
      'profile:own',
      'events:read',
      'giving:create',
      'prayer:create',
      'volunteers:signup',
      'resources:book',
      'sermons:read'
    ]
  );

  RETURN NEW;

END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_seed_church_permissions
AFTER INSERT ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.seed_church_permissions();

