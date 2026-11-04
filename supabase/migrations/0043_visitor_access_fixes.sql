-- Legacy memberships use NULL for active status throughout the application.
-- Keep visitor administration and follow-up authorship consistent with that rule.
CREATE OR REPLACE FUNCTION public.is_visitor_admin(p_church_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_memberships
    WHERE church_id = p_church_id AND user_id = auth.uid()
      AND role = 'super_admin' AND COALESCE(status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_visitor_followup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.notes := btrim(NEW.notes);
  IF NEW.notes IS NULL OR NEW.notes !~ '[^[:space:]]' OR char_length(NEW.notes) > 5000
    OR (NEW.method IS NOT NULL AND NEW.method NOT IN ('call', 'sms', 'email', 'visit', 'in_person')) THEN
    RAISE EXCEPTION 'Enter a valid follow-up method and note of up to 5000 characters' USING ERRCODE = '22023';
  END IF;
  IF NEW.author_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.church_memberships m JOIN public.visitors v ON v.church_id = m.church_id
    WHERE v.id = NEW.visitor_id AND m.id = NEW.author_membership_id
      AND m.role = 'super_admin' AND COALESCE(m.status, 'active') = 'active'
      AND (auth.uid() IS NULL OR m.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'The follow-up author must be a super admin of this church' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
