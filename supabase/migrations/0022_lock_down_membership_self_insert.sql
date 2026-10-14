-- ============================================
-- 0022_lock_down_membership_self_insert.sql
-- ============================================
-- SECURITY FIX.
--
-- The original insert policy on public.church_memberships was:
--
--   CREATE POLICY "memberships_insert_self" ON public.church_memberships
--     FOR INSERT WITH CHECK (user_id = auth.uid());
--
-- It only checked that the row belonged to the caller, never the role. Any
-- signed-in user could POST straight to /rest/v1/church_memberships and insert
-- themselves as role = 'super_admin' into ANY church, then read that church's
-- members, giving, messages and settings.
--
-- Every membership insert in the app already runs through the service-role
-- client, which bypasses RLS, so broad self-service inserts are not needed. We
-- keep a deliberately narrow policy for the one legitimate case - joining a
-- church as a plain member - and forbid forged privileged fields. Promoting
-- someone to leader/admin stays a server-side action.
--
-- There is no UPDATE policy on this table, so a member cannot escalate their
-- role after joining either.

DROP POLICY IF EXISTS "memberships_insert_self" ON public.church_memberships;

CREATE POLICY "memberships_insert_self" ON public.church_memberships
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND COALESCE(status, 'active') = 'active'
    AND COALESCE(is_baptized, FALSE) = FALSE
    AND COALESCE(badges, '{}'::badge_type[]) = '{}'::badge_type[]
  );
