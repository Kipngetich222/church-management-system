-- ============================================
-- 0009_sermons_rls_policies.sql
-- Sermons RLS Policy Refinement
-- ============================================

-- ============================================
-- REMOVE EXISTING ADMIN WRITE POLICY
-- ============================================

DROP POLICY IF EXISTS "sermons_admin_write"
ON public.sermons;

-- ============================================
-- ADMIN INSERT
-- ============================================

CREATE POLICY "sermons_admin_insert_update"
ON public.sermons
FOR INSERT
WITH CHECK (
public.is_church_admin(church_id)
);

-- ============================================
-- ADMIN UPDATE
-- ============================================

CREATE POLICY "sermons_admin_update"
ON public.sermons
FOR UPDATE
USING (
public.is_church_admin(church_id)
);

-- ============================================
-- SUPER ADMIN DELETE
-- ============================================

CREATE POLICY "sermons_super_admin_delete"
ON public.sermons
FOR DELETE
USING (
EXISTS (
SELECT 1
FROM public.church_memberships
WHERE user_id = auth.uid()
AND church_id = sermons.church_id
AND role = 'super_admin'
)
);
