-- ============================================
-- 0033_prayer_counselling_targeting.sql
-- ============================================
-- Distinguishes prayer requests from counselling requests and records who a
-- request was channelled to:
--
--   church  -> the whole church can see and pray for it
--   leaders -> church admins / pastors see it
--   person  -> one specific pastor or leader sees it (assigned_to)
--
-- Prayer requests are soft-archived when answered/closed and are hidden from
-- active lists after seven days. Counselling requests stay open until the
-- person handling them closes the request.

ALTER TABLE public.prayer_requests
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'leaders',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prayer_requests_audience_check'
      AND conrelid = 'public.prayer_requests'::regclass
  ) THEN
    ALTER TABLE public.prayer_requests
      ADD CONSTRAINT prayer_requests_audience_check
      CHECK (audience IN ('church', 'leaders', 'person'));
  END IF;
END
$$;

-- Existing counselling rows were usually addressed to a person already. Keep
-- that intent when the original assignee is known.
UPDATE public.prayer_requests
SET audience = 'person'
WHERE type = 'counseling'
  AND assigned_to IS NOT NULL
  AND audience <> 'person';

UPDATE public.prayer_requests
SET archived_at = COALESCE(closed_at, updated_at, NOW())
WHERE type = 'prayer'
  AND status IN ('closed', 'answered')
  AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prayer_assigned
  ON public.prayer_requests(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_prayer_active
  ON public.prayer_requests(church_id, type, status, created_at DESC);

-- Keep closed_at / archived_at in sync with the status. A prayer request is
-- archived as soon as it is answered or closed; re-opening it restores it.
CREATE OR REPLACE FUNCTION public.touch_prayer_request_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();

  IF NEW.status IN ('closed', 'answered') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, NOW());

    IF NEW.type = 'prayer' AND NEW.archived_at IS NULL THEN
      NEW.archived_at := NOW();
    END IF;
  ELSE
    NEW.closed_at := NULL;
    NEW.archived_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_prayer_request_state
  ON public.prayer_requests;

CREATE TRIGGER trg_touch_prayer_request_state
BEFORE INSERT OR UPDATE ON public.prayer_requests
FOR EACH ROW
EXECUTE FUNCTION public.touch_prayer_request_state();

-- --------------------------------------------
-- SELECT POLICY
-- --------------------------------------------
-- Members can always see their own requests. Pastors/admins see every request
-- in their church. A specifically assigned leader sees the request addressed to
-- them. Church-wide prayer requests are visible to signed-in members while
-- they are active (within seven days and not answered/closed). Public prayer
-- wall entries remain readable by signed-out visitors for the same window.
DROP POLICY IF EXISTS "prayer_req_owner_or_admin"
  ON public.prayer_requests;

DROP POLICY IF EXISTS "prayer_req_select_visible"
  ON public.prayer_requests;

CREATE POLICY "prayer_req_select_visible"
ON public.prayer_requests
FOR SELECT
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
  OR (
    type = 'prayer'
    AND archived_at IS NULL
    AND status IN ('open', 'in_progress')
    AND created_at > NOW() - INTERVAL '7 days'
    AND (
      visibility IN ('public_anonymous', 'public_named')
      OR (
        audience = 'church'
        AND church_id IN (
          SELECT church_id
          FROM public.church_memberships
          WHERE user_id = auth.uid()
        )
      )
    )
  )
);

-- --------------------------------------------
-- UPDATE POLICY
-- --------------------------------------------
-- The owner may edit their request. Pastors/admins and the assigned leader may
-- update progress, notes and status.
DROP POLICY IF EXISTS "prayer_req_update_owner_or_admin"
  ON public.prayer_requests;

DROP POLICY IF EXISTS "prayer_req_update_visible"
  ON public.prayer_requests;

CREATE POLICY "prayer_req_update_visible"
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
);

-- --------------------------------------------
-- INTERACTION POLICIES
-- --------------------------------------------
-- Owners, admins and the assigned leader can read the conversation. Internal
-- notes stay visible to church admins only.
DROP POLICY IF EXISTS "prayer_interactions_read"
  ON public.prayer_interactions;

CREATE POLICY "prayer_interactions_read"
ON public.prayer_interactions
FOR SELECT
USING (
  request_id IN (
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
    is_internal = FALSE
    OR public.is_church_admin(
      (
        SELECT church_id
        FROM public.prayer_requests
        WHERE id = request_id
      )
    )
  )
);

DROP POLICY IF EXISTS "prayer_interactions_write"
  ON public.prayer_interactions;

CREATE POLICY "prayer_interactions_write"
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
);
