-- ============================================
-- 0023_member_profiles_and_leadership.sql
-- ============================================
-- Two related additions:
--
-- 1) PERSON-LEVEL PROFILE
--    Phone was already on public.users, but date of birth and gender lived
--    only on the church membership. A person is the same person across
--    churches, and the post-signup profile widget runs BEFORE any membership
--    exists, so we promote date_of_birth / gender / category (men, women,
--    youth) to the users row and treat it as the single source of truth for
--    personal details. Membership rows keep their denormalised copies for the
--    admin list views and are kept in sync by trigger.
--
--    profile_completed_at records the moment the user finished the signup
--    widget. Completion itself is derived from phone + gender + category so we
--    never lock a user out just because a timestamp is missing.
--
-- 2) CHURCH LEADERSHIP STRUCTURE
--    churches can publish a leadership structure (name, role/title, email and
--    an optional photo) which shows on the public church profile.

-- --------------------------------------------
-- MEMBER CATEGORY
-- --------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_category') THEN
    CREATE TYPE member_category AS ENUM ('men', 'women', 'youth');
  END IF;
END
$$;

-- --------------------------------------------
-- PERSON-LEVEL PROFILE COLUMNS
-- --------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS category member_category,
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Backfill from whatever the memberships already know about the person.
UPDATE public.users u
SET
  date_of_birth = COALESCE(u.date_of_birth, sub.date_of_birth),
  gender = COALESCE(u.gender, sub.gender)
FROM (
  SELECT
    user_id,
    MAX(date_of_birth) AS date_of_birth,
    (ARRAY_AGG(gender) FILTER (WHERE gender IS NOT NULL))[1] AS gender
  FROM public.church_memberships
  GROUP BY user_id
) sub
WHERE sub.user_id = u.id
  AND (u.date_of_birth IS NULL OR u.gender IS NULL);

-- Mark existing people who already supplied a phone as complete so we do not
-- wall them off behind the new widget on their next sign-in.
UPDATE public.users
SET profile_completed_at = NOW()
WHERE profile_completed_at IS NULL
  AND phone IS NOT NULL
  AND btrim(phone) <> '';

-- --------------------------------------------
-- KEEP MEMBERSHIP COPIES IN SYNC (users -> memberships)
-- --------------------------------------------
-- New membership: seed the denormalised date of birth / gender from the person
-- row so the admin screens show the right values immediately.
CREATE OR REPLACE FUNCTION public.sync_membership_profile_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  person public.users%ROWTYPE;
BEGIN
  SELECT * INTO person FROM public.users WHERE id = NEW.user_id;

  IF person.id IS NOT NULL THEN
    IF NEW.date_of_birth IS NULL THEN
      NEW.date_of_birth := person.date_of_birth;
    END IF;
    IF NEW.gender IS NULL THEN
      NEW.gender := person.gender;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_profile_seed ON public.church_memberships;

CREATE TRIGGER trg_membership_profile_seed
BEFORE INSERT ON public.church_memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_membership_profile_from_user();

-- Person row edits: fan the personal fields back out to every membership.
CREATE OR REPLACE FUNCTION public.propagate_user_profile_to_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth)
     OR (OLD.gender IS DISTINCT FROM NEW.gender) THEN
    UPDATE public.church_memberships
    SET
      date_of_birth = NEW.date_of_birth,
      gender = NEW.gender
    WHERE user_id = NEW.id
      AND (date_of_birth IS DISTINCT FROM NEW.date_of_birth
           OR gender IS DISTINCT FROM NEW.gender);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_user_profile ON public.users;

CREATE TRIGGER trg_propagate_user_profile
AFTER UPDATE OF date_of_birth, gender ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.propagate_user_profile_to_memberships();

-- Keep updated_at honest on profile edits.
CREATE OR REPLACE FUNCTION public.touch_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON public.users;

CREATE TRIGGER trg_users_touch_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.touch_users_updated_at();

-- --------------------------------------------
-- CHURCH LEADERSHIP
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.church_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_church_leaders_church
  ON public.church_leaders(church_id, sort_order);

ALTER TABLE public.church_leaders ENABLE ROW LEVEL SECURITY;

-- Anyone (including signed-out visitors) may read a church's leadership so it
-- can be shown on the public profile.
DROP POLICY IF EXISTS "church_leaders_public_read" ON public.church_leaders;
CREATE POLICY "church_leaders_public_read" ON public.church_leaders
  FOR SELECT USING (TRUE);

-- Admins manage their own church's leadership.
DROP POLICY IF EXISTS "church_leaders_admin_insert" ON public.church_leaders;
CREATE POLICY "church_leaders_admin_insert" ON public.church_leaders
  FOR INSERT WITH CHECK (public.is_church_admin(church_id));

DROP POLICY IF EXISTS "church_leaders_admin_update" ON public.church_leaders;
CREATE POLICY "church_leaders_admin_update" ON public.church_leaders
  FOR UPDATE USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

-- Only the church's super admin may remove a leader.
DROP POLICY IF EXISTS "church_leaders_super_admin_delete" ON public.church_leaders;
CREATE POLICY "church_leaders_super_admin_delete" ON public.church_leaders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.church_memberships
      WHERE user_id = auth.uid()
        AND church_id = church_leaders.church_id
        AND role = 'super_admin'
    )
  );
