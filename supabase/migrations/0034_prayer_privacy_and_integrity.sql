-- ============================================
-- 0034_prayer_privacy_and_integrity.sql
-- ============================================
-- Hardens the prayer/counselling data model:
--
--   * counselling requests and personally addressed requests must never be
--     published on the public prayer wall
--   * a request may only reference memberships that belong to its church
--   * internal notes may only be written by church leadership

-- Existing rows created before the privacy guard. Any counselling or
-- personally addressed request that had been marked public is pulled back to
-- leadership-only visibility.
UPDATE public.prayer_requests
SET visibility = 'pastors_only'
WHERE (type = 'counseling' OR audience = 'person')
  AND visibility IN ('public_anonymous', 'public_named');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prayer_requests_private_visibility_check'
      AND conrelid = 'public.prayer_requests'::regclass
  ) THEN
    ALTER TABLE public.prayer_requests
      ADD CONSTRAINT prayer_requests_private_visibility_check
      CHECK (
        (type <> 'counseling' AND audience <> 'person')
        OR visibility IN ('private', 'pastors_only')
      );
  END IF;
END
$$;

-- ------------------------------------------------------------
-- MEMBERSHIP LOOKUP (bypasses RLS for policy checks)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.membership_belongs_to_church(
  p_church_id UUID,
  p_membership_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_memberships
    WHERE id = p_membership_id
      AND church_id = p_church_id
  );
$$;

-- ------------------------------------------------------------
-- INSERT POLICY
-- ------------------------------------------------------------
DROP POLICY IF EXISTS prayer_req_insert_self
  ON public.prayer_requests;

CREATE POLICY prayer_req_insert_self
ON public.prayer_requests
FOR INSERT
WITH CHECK (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  AND public.membership_belongs_to_church(church_id, membership_id)
  AND (
    assigned_to IS NULL
    OR public.membership_belongs_to_church(church_id, assigned_to)
  )
);

-- ------------------------------------------------------------
-- UPDATE POLICY
-- ------------------------------------------------------------
DROP POLICY IF EXISTS prayer_req_update_visible
  ON public.prayer_requests;

CREATE POLICY prayer_req_update_visible
ON public.prayer_requests
FOR UPDATE
USING (
  membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR assigned_to IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  OR public.is_church_admin(church_id)
)
WITH CHECK (
  public.membership_belongs_to_church(church_id, membership_id)
  AND (
    assigned_to IS NULL
    OR public.membership_belongs_to_church(church_id, assigned_to)
  )
);

-- ------------------------------------------------------------
-- INTERACTION WRITE POLICY
-- ------------------------------------------------------------
DROP POLICY IF EXISTS prayer_interactions_write
  ON public.prayer_interactions;

CREATE POLICY prayer_interactions_write
ON public.prayer_interactions
FOR INSERT
WITH CHECK (
  author_membership_id IN (
    SELECT id
    FROM public.church_memberships
    WHERE user_id = auth.uid()
  )
  AND request_id IN (
    SELECT id
    FROM public.prayer_requests
    WHERE membership_id IN (
        SELECT id
        FROM public.church_memberships
        WHERE user_id = auth.uid()
      )
      OR assigned_to IN (
        SELECT id
        FROM public.church_memberships
        WHERE user_id = auth.uid()
      )
      OR public.is_church_admin(church_id)
  )
  AND (
    COALESCE(is_internal, FALSE) = FALSE
    OR public.is_church_admin(
      (
        SELECT church_id
        FROM public.prayer_requests
        WHERE id = request_id
      )
    )
  )
);
