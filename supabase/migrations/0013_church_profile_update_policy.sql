-- ============================================
-- 0013_church_profile_update_policy.sql
-- ============================================
--
-- BUG:
--   Saving the church profile (Admin -> Settings -> Church profile) silently
--   did nothing, so the address / latitude / longitude set by an admin were
--   never persisted. The member dashboard "Find us" card then kept showing
--   "Your church has not set a location yet".
--
--   The browser form writes straight to public.churches with the user-scoped
--   Supabase client, but churches only had SELECT (churches_public_read) and
--   INSERT (churches_authenticated_create) policies. With RLS enabled and no
--   UPDATE policy an UPDATE matches zero rows and PostgREST still reports
--   success, so the change was dropped without any error being surfaced.
--
-- FIX:
--   Let church admins (super_admin / dept_admin) update their own church. Uses
--   the existing is_church_admin() helper, matching the departments / groups /
--   events policies.

DROP POLICY IF EXISTS "churches_admin_update" ON public.churches;

CREATE POLICY "churches_admin_update" ON public.churches
  FOR UPDATE
  USING (public.is_church_admin(id))
  WITH CHECK (public.is_church_admin(id));