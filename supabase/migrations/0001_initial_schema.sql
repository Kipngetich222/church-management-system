-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('super_admin', 'dept_admin', 'member');
CREATE TYPE plan_tier AS ENUM ('basic', 'premium');
CREATE TYPE badge_type AS ENUM (
  'pastor', 'usher', 'worship', 'choir', 'media',
  'youth', 'children', 'baptized', 'elder', 'deacon'
);

-- ============================================
-- USERS (extends auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- CHURCHES
-- ============================================
CREATE TABLE public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  email TEXT,
  website TEXT,
  plan plan_tier DEFAULT 'basic',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_churches_slug ON public.churches(slug);

-- ============================================
-- CHURCH MEMBERSHIPS (the join table)
-- ============================================
CREATE TABLE public.church_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  badges badge_type[] DEFAULT '{}',
  is_baptized BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, church_id)
);

CREATE INDEX idx_memberships_user ON public.church_memberships(user_id);
CREATE INDEX idx_memberships_church ON public.church_memberships(church_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Churches: public read, authenticated create
CREATE POLICY "churches_public_read" ON public.churches
  FOR SELECT USING (TRUE);

CREATE POLICY "churches_authenticated_create" ON public.churches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Memberships: user sees their own; admins see church memberships
CREATE POLICY "memberships_read_own" ON public.church_memberships
  FOR SELECT USING (
    user_id = auth.uid()
    OR church_id IN (
      SELECT church_id FROM public.church_memberships
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'dept_admin')
    )
  );

CREATE POLICY "memberships_insert_self" ON public.church_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
-- Check if the current user is admin of a given church
CREATE OR REPLACE FUNCTION public.is_church_admin(church_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_memberships
    WHERE user_id = auth.uid()
      AND church_id = church_uuid
      AND role IN ('super_admin', 'dept_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's role in a church
CREATE OR REPLACE FUNCTION public.user_role_in_church(church_uuid UUID)
RETURNS user_role AS $$
  SELECT role FROM public.church_memberships
  WHERE user_id = auth.uid() AND church_id = church_uuid
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;