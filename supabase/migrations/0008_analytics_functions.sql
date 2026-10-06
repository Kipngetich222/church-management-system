-- ============================================
-- 0008_analytics_functions.sql
-- Analytics Functions
-- Member Growth & Event Attendance
-- ============================================

-- ============================================
-- MEMBER GROWTH BY MONTH
-- ============================================

CREATE OR REPLACE FUNCTION public.member_growth_by_month(
p_church_id UUID
)
RETURNS TABLE(
month TEXT,
count BIGINT
)
AS $$
SELECT
TO_CHAR(joined_at, 'YYYY-MM') AS month,
COUNT(*) AS count
FROM public.church_memberships
WHERE church_id = p_church_id
GROUP BY 1
ORDER BY 1;

$$
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public;


-- ============================================
-- ATTENDANCE BY EVENT
-- ============================================

CREATE OR REPLACE FUNCTION public.attendance_by_event(
  p_church_id UUID
)
RETURNS TABLE(
  event_title TEXT,
  event_date DATE,
  count BIGINT
)
AS $$
  SELECT
    e.title AS event_title,
    DATE(e.start_time) AS event_date,
    COUNT(a.id) AS count
  FROM public.events e
  LEFT JOIN public.event_attendance a
    ON a.event_id = e.id
  WHERE e.church_id = p_church_id
  GROUP BY
    e.id,
    e.title,
    e.start_time
  ORDER BY e.start_time DESC
  LIMIT 30;
$$

LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public;
