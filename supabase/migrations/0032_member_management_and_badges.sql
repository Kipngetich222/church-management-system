-- ============================================
-- 0032_member_management_and_badges.sql
-- ============================================
-- Member management upgrade:
--   * memberships can exist without an auth user (manual / SMS members)
--   * contact details can live on the membership row itself
--   * church-defined badge roles are free-form (no enum restrictions)
--   * children can be represented as a member category

-- ---------------------------------------------------------------------------
-- FREE-FORM BADGES
-- ---------------------------------------------------------------------------
-- The old badge_type enum made every church share the same ten titles. Badges
-- are church leadership / service roles and must be editable per church.
DROP POLICY IF EXISTS "memberships_insert_self" ON public.church_memberships;

ALTER TABLE public.church_memberships
  ALTER COLUMN badges DROP DEFAULT;

ALTER TABLE public.church_memberships
  ALTER COLUMN badges TYPE TEXT[] USING badges::TEXT[];

ALTER TABLE public.church_memberships
  ALTER COLUMN badges SET DEFAULT '{}'::TEXT[];

CREATE POLICY "memberships_insert_self" ON public.church_memberships
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND COALESCE(status, 'active') = 'active'
    AND COALESCE(is_baptized, FALSE) = FALSE
    AND COALESCE(badges, '{}'::TEXT[]) = '{}'::TEXT[]
  );

-- ---------------------------------------------------------------------------
-- MANUAL MEMBERS (no smartphone / no account)
-- ---------------------------------------------------------------------------
ALTER TABLE public.church_memberships
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.church_memberships
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS category public.member_category,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill the denormalised contact fields for existing account members so the
-- admin list can keep rendering after the join is made optional.
UPDATE public.church_memberships m
SET
  full_name = COALESCE(m.full_name, u.full_name),
  email = COALESCE(m.email, u.email),
  phone = COALESCE(m.phone, u.phone),
  category = COALESCE(m.category, u.category),
  avatar_url = COALESCE(m.avatar_url, u.avatar_url)
FROM public.users u
WHERE m.user_id = u.id
  AND (
    m.full_name IS NULL OR m.email IS NULL OR m.phone IS NULL
    OR m.category IS NULL OR m.avatar_url IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_memberships_church_category
  ON public.church_memberships(church_id, category);

-- ---------------------------------------------------------------------------
-- ADMIN PROFILE VISIBILITY
-- ---------------------------------------------------------------------------
-- Admin screens embed users(full_name, email, phone). The original users
-- policy only allowed a person to read their own row, so those embeds came
-- back empty for everyone else. Give church admins read access to the profiles
-- of people who belong to one of their churches.
CREATE OR REPLACE FUNCTION public.is_admin_for_user(target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_memberships target
    JOIN public.church_memberships viewer
      ON viewer.church_id = target.church_id
    WHERE target.user_id = target_user
      AND viewer.user_id = auth.uid()
      AND viewer.role IN ('super_admin', 'dept_admin')
  );
$$;

DROP POLICY IF EXISTS "users_read_church_admins" ON public.users;
CREATE POLICY "users_read_church_admins" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin_for_user(id)
  );


ALTER TABLE public.church_memberships
  DROP CONSTRAINT IF EXISTS memberships_manual_name_check;

ALTER TABLE public.church_memberships
  ADD CONSTRAINT memberships_manual_name_check
  CHECK (user_id IS NOT NULL OR (full_name IS NOT NULL AND btrim(full_name) <> ''));

-- Keep the membership copies in sync with the person row for account members.
CREATE OR REPLACE FUNCTION public.sync_membership_contact_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person public.users%ROWTYPE;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO person FROM public.users WHERE id = NEW.user_id;

  IF person.id IS NOT NULL THEN
    NEW.full_name := COALESCE(NEW.full_name, person.full_name);
    NEW.email := COALESCE(NEW.email, person.email);
    NEW.phone := COALESCE(NEW.phone, person.phone);
    NEW.category := COALESCE(NEW.category, person.category);
    NEW.avatar_url := COALESCE(NEW.avatar_url, person.avatar_url);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_contact_seed ON public.church_memberships;
CREATE TRIGGER trg_membership_contact_seed
BEFORE INSERT OR UPDATE OF user_id ON public.church_memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_membership_contact_from_user();

CREATE OR REPLACE FUNCTION public.propagate_user_contact_to_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.full_name IS DISTINCT FROM NEW.full_name)
     OR (OLD.email IS DISTINCT FROM NEW.email)
     OR (OLD.phone IS DISTINCT FROM NEW.phone)
     OR (OLD.category IS DISTINCT FROM NEW.category)
     OR (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url) THEN
    UPDATE public.church_memberships
    SET
      full_name = NEW.full_name,
      email = NEW.email,
      phone = NEW.phone,
      category = NEW.category,
      avatar_url = NEW.avatar_url
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_user_contact ON public.users;
CREATE TRIGGER trg_propagate_user_contact
AFTER UPDATE OF full_name, email, phone, category, avatar_url ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.propagate_user_contact_to_memberships();

-- ---------------------------------------------------------------------------
-- CHURCH-DEFINED BADGE ROLES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'award',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, name)
);

CREATE INDEX IF NOT EXISTS idx_member_badges_church
  ON public.member_badges(church_id, sort_order, name);

-- Badge names are roles, so keep them unique regardless of letter case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_badges_church_name_lower
  ON public.member_badges(church_id, lower(name));

DROP TRIGGER IF EXISTS trg_member_badges_touch ON public.member_badges;
CREATE TRIGGER trg_member_badges_touch
BEFORE UPDATE ON public.member_badges
FOR EACH ROW
EXECUTE FUNCTION public.touch_users_updated_at();

ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_badges_read" ON public.member_badges;
CREATE POLICY "member_badges_read" ON public.member_badges
  FOR SELECT USING (
    public.is_church_admin(church_id)
    OR church_id IN (
      SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "member_badges_admin_write" ON public.member_badges;
CREATE POLICY "member_badges_admin_write" ON public.member_badges
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

-- Seed a useful starter catalogue for every existing church. Churches can
-- rename, recolour, delete or add any role they like afterwards.
INSERT INTO public.member_badges
  (church_id, name, description, color, icon, sort_order)
SELECT
  c.id,
  v.name,
  v.description,
  v.color,
  v.icon,
  v.sort_order
FROM public.churches c
CROSS JOIN (VALUES
  ('pastor', 'Shepherds and leads the congregation', '#7c3aed', 'crown', 10),
  ('elder', 'Senior spiritual leadership', '#d97706', 'shield', 20),
  ('deacon', 'Serves the church and community', '#0d9488', 'hand-heart', 30),
  ('usher', 'Welcomes and seats the congregation', '#2563eb', 'users', 40),
  ('worship', 'Leads the church in worship', '#db2777', 'music', 50),
  ('choir', 'Sings in the church choir', '#e11d48', 'mic', 60),
  ('media', 'Runs sound, screens and live streams', '#0891b2', 'clapperboard', 70),
  ('youth', 'Leads or serves the youth ministry', '#ea580c', 'sparkles', 80),
  ('children', 'Serves the children ministry', '#16a34a', 'baby', 90),
  ('teacher', 'Teaches scripture and discipleship', '#4f46e5', 'book-open', 100),
  ('evangelist', 'Leads outreach and evangelism', '#059669', 'megaphone', 110),
  ('volunteer', 'Serves wherever needed', '#475569', 'heart', 120)
) AS v(name, description, color, icon, sort_order)
ON CONFLICT DO NOTHING;

-- New churches get the same starter catalogue.
CREATE OR REPLACE FUNCTION public.seed_church_member_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_badges
    (church_id, name, description, color, icon, sort_order)
  VALUES
    (NEW.id, 'pastor', 'Shepherds and leads the congregation', '#7c3aed', 'crown', 10),
    (NEW.id, 'elder', 'Senior spiritual leadership', '#d97706', 'shield', 20),
    (NEW.id, 'deacon', 'Serves the church and community', '#0d9488', 'hand-heart', 30),
    (NEW.id, 'usher', 'Welcomes and seats the congregation', '#2563eb', 'users', 40),
    (NEW.id, 'worship', 'Leads the church in worship', '#db2777', 'music', 50),
    (NEW.id, 'choir', 'Sings in the church choir', '#e11d48', 'mic', 60),
    (NEW.id, 'media', 'Runs sound, screens and live streams', '#0891b2', 'clapperboard', 70),
    (NEW.id, 'youth', 'Leads or serves the youth ministry', '#ea580c', 'sparkles', 80),
    (NEW.id, 'children', 'Serves the children ministry', '#16a34a', 'baby', 90),
    (NEW.id, 'teacher', 'Teaches scripture and discipleship', '#4f46e5', 'book-open', 100),
    (NEW.id, 'evangelist', 'Leads outreach and evangelism', '#059669', 'megaphone', 110),
    (NEW.id, 'volunteer', 'Serves wherever needed', '#475569', 'heart', 120)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_church_member_badges ON public.churches;
CREATE TRIGGER trg_seed_church_member_badges
AFTER INSERT ON public.churches
FOR EACH ROW
EXECUTE FUNCTION public.seed_church_member_badges();
