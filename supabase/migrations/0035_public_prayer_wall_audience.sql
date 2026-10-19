-- ============================================
-- 0035_public_prayer_wall_audience.sql
-- ============================================
-- Only church-wide prayer requests may be published on the public prayer wall.
-- Leader-only and personally addressed prayers must stay private even if a
-- caller attempts to submit or update them with a public visibility value.

-- Older public-wall rows predate the audience column and therefore defaulted
-- to leaders. Their public visibility was an explicit choice, so keep them
-- on the wall by marking them as church-wide.
UPDATE public.prayer_requests
SET audience = 'church'
WHERE type = 'prayer'
  AND visibility IN ('public_anonymous', 'public_named')
  AND assigned_to IS NULL;

UPDATE public.prayer_requests
SET visibility = 'pastors_only'
WHERE visibility IN ('public_anonymous', 'public_named')
  AND (type <> 'prayer' OR audience <> 'church');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'prayer_requests_public_audience_check'
      AND conrelid = 'public.prayer_requests'::regclass
  ) THEN
    ALTER TABLE public.prayer_requests
      ADD CONSTRAINT prayer_requests_public_audience_check
      CHECK (
        visibility NOT IN ('public_anonymous', 'public_named')
        OR (type = 'prayer' AND audience = 'church')
      );
  END IF;
END
$$;

DROP POLICY IF EXISTS prayer_req_select_visible
  ON public.prayer_requests;

CREATE POLICY prayer_req_select_visible
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
    AND audience = 'church'
    AND archived_at IS NULL
    AND status IN ('open', 'in_progress')
    AND created_at > NOW() - INTERVAL '7 days'
    AND (
      visibility IN ('public_anonymous', 'public_named')
      OR church_id IN (
        SELECT church_id
        FROM public.church_memberships
        WHERE user_id = auth.uid()
      )
    )
  )
);
