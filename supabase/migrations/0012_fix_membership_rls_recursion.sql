-- ============================================
-- FIX: "infinite recursion detected in policy for relation church_memberships"
-- ============================================
-- Symptom:
--   Any query against public.church_memberships made as a signed-in user fails
--   with:  42P17 infinite recursion detected in policy for relation
--          "church_memberships"
--
--   Because every membership read fails, the app cannot tell that a user
--   belongs to a church. They are bounced straight back to /onboarding (and the
--   onboarding page itself never sees their membership), so nobody can reach a
--   dashboard - even after creating or joining a church.
--
-- Cause:
--   The SELECT policy "memberships_read_own" contains a subquery that selects
--   from church_memberships *inside its own USING clause*. Evaluating the policy
--   requires evaluating the policy again -> Postgres aborts with infinite
--   recursion.
--
-- Fix:
--   Replace the self-referential subquery with the existing SECURITY DEFINER
--   helper public.is_church_admin(), which reads church_memberships without
--   triggering RLS (and therefore cannot recurse).

DROP POLICY IF EXISTS "memberships_read_own" ON public.church_memberships;

CREATE POLICY "memberships_read_own" ON public.church_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_church_admin(church_id)
  );

-- ============================================
-- FIX: same class of bug on department_members
-- ============================================
-- "dept_members_write" selected from department_members inside its own policy
-- (via the leader check). Extract that check into a SECURITY DEFINER helper.

CREATE OR REPLACE FUNCTION public.is_department_leader(department_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_members dm
    JOIN public.church_memberships cm ON cm.id = dm.membership_id
    WHERE dm.department_id = department_uuid
      AND cm.user_id = auth.uid()
      AND dm.is_leader = TRUE
  );
$$;

DROP POLICY IF EXISTS "dept_members_write" ON public.department_members;

CREATE POLICY "dept_members_write" ON public.department_members
  FOR ALL USING (
    department_id IN (
      SELECT d.id FROM public.departments d
      WHERE public.is_church_admin(d.church_id)
         OR public.is_department_leader(d.id)
    )
  )
  WITH CHECK (
    department_id IN (
      SELECT d.id FROM public.departments d
      WHERE public.is_church_admin(d.church_id)
         OR public.is_department_leader(d.id)
    )
  );
