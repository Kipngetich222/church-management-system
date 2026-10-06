-- Drop the broad FOR ALL write policies on departments/groups
DROP POLICY IF EXISTS "departments_admin_write" ON public.departments;
DROP POLICY IF EXISTS "groups_admin_write" ON public.small_groups;

-- Insert + Update: any admin (super or dept)
CREATE POLICY "departments_admin_insert" ON public.departments
  FOR INSERT WITH CHECK (public.is_church_admin(church_id));

CREATE POLICY "departments_admin_update" ON public.departments
  FOR UPDATE USING (public.is_church_admin(church_id));

-- Delete: super_admin only
CREATE POLICY "departments_super_admin_delete" ON public.departments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.church_memberships
      WHERE user_id = auth.uid()
        AND church_id = departments.church_id
        AND role = 'super_admin'
    )
  );

CREATE POLICY "groups_admin_insert" ON public.small_groups
  FOR INSERT WITH CHECK (public.is_church_admin(church_id));

CREATE POLICY "groups_admin_update" ON public.small_groups
  FOR UPDATE USING (public.is_church_admin(church_id));

CREATE POLICY "groups_super_admin_delete" ON public.small_groups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.church_memberships
      WHERE user_id = auth.uid()
        AND church_id = small_groups.church_id
        AND role = 'super_admin'
    )
  );