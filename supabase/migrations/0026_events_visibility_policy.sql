-- ============================================
-- 0026_events_visibility_policy.sql
-- Audience-aware read policy + engagement stats helper.
--
-- Depends on the new event_visibility values added in 0025. Migrations run in
-- order, each in its own transaction, so the new values are committed and safe
-- to use here.
-- ============================================

-- --------------------------------------------
-- AUDIENCE-AWARE READ POLICY
-- --------------------------------------------
-- Replaces the old policy which let any church member read every event of
-- their church (including drafts). Now:
--   * church admins see everything for their church (drafts included);
--   * everyone else only sees published / completed / cancelled events that
--     are public OR match an audience they belong to.
DROP POLICY IF EXISTS "events_public_read" ON public.events;
DROP POLICY IF EXISTS "events_read" ON public.events;

CREATE POLICY "events_read" ON public.events
FOR SELECT
USING (
  -- Church admins (super_admin / dept_admin) see all statuses.
  public.is_church_admin(events.church_id)
  OR (
    events.status IN ('published', 'completed', 'cancelled')
    AND (
      -- Public events are visible to everyone when published/completed.
      (events.visibility = 'public' AND events.status IN ('published', 'completed'))
      -- Otherwise the viewer must be a member of the event church AND match
      -- the chosen audience.
      OR events.church_id IN (
        SELECT cm.church_id
        FROM public.church_memberships cm
        WHERE cm.user_id = auth.uid()
          AND (
            events.visibility IN ('members_only', 'all_members')
            OR (events.visibility = 'super_admins' AND cm.role = 'super_admin')
            OR (
              events.visibility IN ('men', 'women', 'youth')
              AND EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = auth.uid()
                  AND u.category IS NOT NULL
                  AND u.category::text = events.visibility::text
              )
            )
            OR (
              events.visibility = 'department'
              AND events.visibility_department_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM public.department_members dm
                JOIN public.church_memberships cm2 ON cm2.id = dm.membership_id
                WHERE dm.department_id = events.visibility_department_id
                  AND cm2.user_id = auth.uid()
                  AND cm2.church_id = events.church_id
              )
            )
            OR (
              events.visibility = 'group'
              AND events.visibility_group_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM public.small_group_members sgm
                JOIN public.church_memberships cm3 ON cm3.id = sgm.membership_id
                WHERE sgm.group_id = events.visibility_group_id
                  AND cm3.user_id = auth.uid()
                  AND cm3.church_id = events.church_id
              )
            )
          )
      )
    )
  )
);

-- --------------------------------------------
-- ENGAGEMENT STATS HELPER
-- --------------------------------------------
-- Per-event booking + attendance counts in one round trip, for the admin
-- event dashboards. Admin-scoped by the caller.
DROP FUNCTION IF EXISTS public.event_engagement(UUID);

CREATE FUNCTION public.event_engagement(p_event_id UUID)
RETURNS TABLE (
  booked BIGINT,
  paid BIGINT,
  confirmed BIGINT,
  attendance BIGINT,
  revenue NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(reg.booked, 0),
    COALESCE(reg.paid, 0),
    COALESCE(reg.confirmed, 0),
    COALESCE(att.attendance, 0),
    COALESCE(reg.revenue, 0)
  FROM
    (
      SELECT
        COUNT(*) FILTER (WHERE status IN ('registered', 'checked_in')) AS booked,
        COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid,
        COUNT(*) FILTER (WHERE status = 'checked_in') AS confirmed,
        COALESCE(SUM(amount_paid) FILTER (WHERE payment_status = 'paid'), 0) AS revenue
      FROM public.event_registrations
      WHERE event_id = p_event_id
    ) reg
  FULL OUTER JOIN
    (
      SELECT COUNT(*) AS attendance
      FROM public.event_attendance
      WHERE event_id = p_event_id
    ) att ON TRUE;
$$;

GRANT EXECUTE ON FUNCTION public.event_engagement(UUID) TO authenticated;


