-- Keep volunteer administration consistent with the permissions used by the web UI.
CREATE FUNCTION public.has_volunteer_permission(p_church_id UUID, p_permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_memberships m
    JOIN public.role_permissions r ON r.church_id = m.church_id AND r.role = m.role::TEXT
    WHERE m.church_id = p_church_id AND m.user_id = auth.uid()
      AND COALESCE(m.status, 'active') = 'active'
      AND m.role IN ('super_admin', 'dept_admin')
      AND p_permission IN ('volunteers:read', 'volunteers:*')
      AND (p_permission = ANY(r.permissions) OR 'volunteers:*' = ANY(r.permissions))
  );
$$;
REVOKE ALL ON FUNCTION public.has_volunteer_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_volunteer_permission(UUID, TEXT) TO authenticated;

DROP POLICY vol_shifts_admin_write ON public.volunteer_shifts;
CREATE POLICY vol_shifts_admin_insert ON public.volunteer_shifts FOR INSERT TO authenticated
WITH CHECK (public.has_volunteer_permission(church_id, 'volunteers:*'));
CREATE POLICY vol_shifts_admin_update ON public.volunteer_shifts FOR UPDATE TO authenticated
USING (public.has_volunteer_permission(church_id, 'volunteers:*'))
WITH CHECK (public.has_volunteer_permission(church_id, 'volunteers:*'));
CREATE POLICY vol_shifts_admin_delete ON public.volunteer_shifts FOR DELETE TO authenticated
USING (
  public.has_volunteer_permission(church_id, 'volunteers:*')
  AND public.user_role_in_church(church_id) = 'super_admin'
);

DROP POLICY vol_roles_admin_write ON public.volunteer_roles;
CREATE POLICY vol_roles_admin_write ON public.volunteer_roles FOR ALL TO authenticated
USING (public.has_volunteer_permission(church_id, 'volunteers:*'))
WITH CHECK (public.has_volunteer_permission(church_id, 'volunteers:*'));

DROP POLICY vol_signups_read ON public.volunteer_signups;
CREATE POLICY vol_signups_read ON public.volunteer_signups FOR SELECT TO authenticated
USING (
  membership_id IN (SELECT id FROM public.church_memberships WHERE user_id = auth.uid())
  OR shift_id IN (
    SELECT id FROM public.volunteer_shifts
    WHERE public.has_volunteer_permission(church_id, 'volunteers:read')
  )
);
DROP POLICY vol_signups_self_delete ON public.volunteer_signups;
CREATE POLICY vol_signups_self_delete ON public.volunteer_signups FOR DELETE TO authenticated
USING (
  membership_id IN (SELECT id FROM public.church_memberships WHERE user_id = auth.uid())
  OR shift_id IN (
    SELECT id FROM public.volunteer_shifts
    WHERE public.has_volunteer_permission(church_id, 'volunteers:*')
  )
);

-- Membership status is nullable in the original schema. As in the rest of the
-- app, a legacy NULL status means active; explicit inactive statuses stay blocked.
DROP POLICY vol_signups_self_write ON public.volunteer_signups;
CREATE POLICY vol_signups_self_write ON public.volunteer_signups FOR INSERT TO authenticated
WITH CHECK (
  COALESCE(status, 'confirmed') = 'confirmed'
  AND EXISTS (
    SELECT 1 FROM public.church_memberships m JOIN public.volunteer_shifts s ON s.church_id = m.church_id
    WHERE m.id = membership_id AND m.user_id = auth.uid()
      AND COALESCE(m.status, 'active') = 'active' AND s.id = shift_id
  )
);

CREATE OR REPLACE FUNCTION public.validate_volunteer_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE activity public.volunteer_shifts%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.shift_id, NEW.membership_id) IS DISTINCT FROM (OLD.shift_id, OLD.membership_id) THEN
    RAISE EXCEPTION 'A signup cannot be reassigned' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO activity FROM public.volunteer_shifts WHERE id = NEW.shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activity not found' USING ERRCODE = '23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.church_memberships
    WHERE id = NEW.membership_id AND church_id = activity.church_id AND COALESCE(status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'An active membership in this church is required' USING ERRCODE = '23514';
  END IF;
  NEW.status := COALESCE(NEW.status, 'confirmed');
  IF NEW.status NOT IN ('confirmed', 'waitlist', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid signup status' USING ERRCODE = '23514';
  END IF;
  IF NEW.status <> 'cancelled' THEN
    IF NOT activity.is_active OR NOT EXISTS (
      SELECT 1 FROM public.volunteer_next_occurrence(activity.starts_at, activity.ends_at,
        activity.recurrence, activity.recurrence_until, activity.timezone)
    ) THEN
      RAISE EXCEPTION 'Signups for this activity are closed' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'confirmed' AND activity.slots IS NOT NULL AND activity.slots <= (
      SELECT count(*) FROM public.volunteer_signups
      WHERE shift_id = NEW.shift_id AND id <> NEW.id AND COALESCE(status, 'confirmed') = 'confirmed'
    ) THEN
      RAISE EXCEPTION 'This activity is full. Please choose another activity' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_volunteer_activities(p_church_id UUID)
RETURNS TABLE (
  id UUID, church_id UUID, title TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  location TEXT, slots INTEGER, notes TEXT, category TEXT, recurrence TEXT,
  recurrence_until DATE, timezone TEXT, is_active BOOLEAN,
  next_starts_at TIMESTAMPTZ, next_ends_at TIMESTAMPTZ,
  participant_count BIGINT, my_signup_id UUID, my_status TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE own_membership UUID;
BEGIN
  SELECT m.id INTO own_membership FROM public.church_memberships m
  WHERE m.church_id = p_church_id AND m.user_id = auth.uid() AND COALESCE(m.status, 'active') = 'active';
  IF own_membership IS NULL THEN
    RAISE EXCEPTION 'An active membership in this church is required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.id, s.church_id, s.title, s.starts_at, s.ends_at, s.location, s.slots, s.notes,
    s.category, s.recurrence, s.recurrence_until, s.timezone, s.is_active,
    n.next_starts_at, n.next_ends_at,
    (SELECT count(*) FROM public.volunteer_signups v WHERE v.shift_id = s.id AND COALESCE(v.status, 'confirmed') = 'confirmed'),
    mine.id, COALESCE(mine.status, CASE WHEN mine.id IS NOT NULL THEN 'confirmed' END)
  FROM public.volunteer_shifts s
  LEFT JOIN LATERAL public.volunteer_next_occurrence(s.starts_at, s.ends_at, s.recurrence, s.recurrence_until, s.timezone) n ON TRUE
  LEFT JOIN public.volunteer_signups mine ON mine.shift_id = s.id AND mine.membership_id = own_membership
  WHERE s.church_id = p_church_id;
END;
$$;
