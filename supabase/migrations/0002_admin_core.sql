-- ============================================
-- DEPARTMENTS
-- ============================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, name)
);

CREATE INDEX idx_departments_church ON public.departments(church_id);

-- ============================================
-- DEPARTMENT MEMBERS
-- ============================================
CREATE TABLE public.department_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.church_memberships(id) ON DELETE CASCADE,
  is_leader BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, membership_id)
);

CREATE INDEX idx_dept_members_dept ON public.department_members(department_id);
CREATE INDEX idx_dept_members_member ON public.department_members(membership_id);

-- ============================================
-- SMALL GROUPS (cell groups)
-- ============================================
CREATE TABLE public.small_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  meeting_day TEXT,
  meeting_time TEXT,
  location TEXT,
  leader_membership_id UUID REFERENCES public.church_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, name)
);

CREATE TABLE public.small_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.small_groups(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.church_memberships(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, membership_id)
);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_church_created ON public.audit_logs(church_id, created_at DESC);

-- ============================================
-- EXTEND MEMBERSHIPS
-- ============================================
ALTER TABLE public.church_memberships
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- ============================================
-- RLS: DEPARTMENTS
-- ============================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_read_church_members" ON public.departments
  FOR SELECT USING (
    church_id IN (
      SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "departments_admin_write" ON public.departments
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

-- ============================================
-- RLS: DEPARTMENT MEMBERS
-- ============================================
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept_members_read" ON public.department_members
  FOR SELECT USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      WHERE d.church_id IN (
        SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "dept_members_write" ON public.department_members
  FOR ALL USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      WHERE public.is_church_admin(d.church_id)
        OR EXISTS (
          SELECT 1 FROM public.department_members dm
          JOIN public.church_memberships cm ON cm.id = dm.membership_id
          WHERE dm.department_id = d.id
            AND cm.user_id = auth.uid()
            AND dm.is_leader = TRUE
        )
    )
  );

-- ============================================
-- RLS: SMALL GROUPS
-- ============================================
ALTER TABLE public.small_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_read" ON public.small_groups
  FOR SELECT USING (
    church_id IN (
      SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "groups_admin_write" ON public.small_groups
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

CREATE POLICY "group_members_read" ON public.small_group_members
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM public.small_groups WHERE church_id IN (
        SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "group_members_admin_write" ON public.small_group_members
  FOR ALL USING (
    group_id IN (
      SELECT id FROM public.small_groups WHERE public.is_church_admin(church_id)
    )
  );

-- ============================================
-- RLS: AUDIT LOGS
-- ============================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.audit_logs
  FOR SELECT USING (public.is_church_admin(church_id));

CREATE POLICY "audit_admin_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_church_admin(church_id));

-- ============================================
-- STORAGE BUCKET FOR CHURCH ASSETS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('church-assets', 'church-assets', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', TRUE)
ON CONFLICT DO NOTHING;

CREATE POLICY "church_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'church-assets');

CREATE POLICY "church_assets_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'church-assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "member_avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-avatars');

CREATE POLICY "member_avatars_auth_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-avatars'
    AND auth.role() = 'authenticated'
  );