-- One permanent visitor welcome link per church. Anonymous visitors use narrow
-- RPCs; their contact details, comments and staff notes are never public tables.

CREATE OR REPLACE FUNCTION public.is_visitor_admin(p_church_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_memberships
    WHERE church_id = p_church_id AND user_id = auth.uid()
      AND role = 'super_admin' AND status = 'active'
  );
$$;

CREATE TABLE public.visitor_portals (
  church_id UUID PRIMARY KEY REFERENCES public.churches(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  welcome_message TEXT NOT NULL DEFAULT
    'We are glad you are here! Please tell us a little about yourself, then explore our church programme and upcoming activities.',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT visitor_welcome_length CHECK (char_length(btrim(welcome_message)) BETWEEN 1 AND 2000)
);
ALTER TABLE public.visitor_portals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visitor_portals FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (welcome_message) ON public.visitor_portals TO authenticated;
GRANT ALL ON public.visitor_portals TO service_role;
CREATE POLICY visitor_portals_read ON public.visitor_portals FOR SELECT
  USING (public.is_visitor_admin(church_id));
CREATE POLICY visitor_portals_update ON public.visitor_portals FOR UPDATE
  USING (public.is_visitor_admin(church_id)) WITH CHECK (public.is_visitor_admin(church_id));

CREATE FUNCTION public.keep_visitor_portal_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.token IS DISTINCT FROM OLD.token OR NEW.church_id IS DISTINCT FROM OLD.church_id THEN
    RAISE EXCEPTION 'The visitor QR code is permanent and cannot be changed' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER visitor_portal_identity BEFORE UPDATE ON public.visitor_portals
  FOR EACH ROW EXECUTE FUNCTION public.keep_visitor_portal_identity();

CREATE FUNCTION public.ensure_visitor_portal(p_church_id UUID)
RETURNS SETOF public.visitor_portals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_visitor_admin(p_church_id) THEN
    RAISE EXCEPTION 'Only an active super admin can generate the visitor QR code' USING ERRCODE = '42501';
  END IF;
  -- A unique church key plus ON CONFLICT also covers concurrent generators.
  INSERT INTO public.visitor_portals(church_id, created_by)
    VALUES (p_church_id, auth.uid()) ON CONFLICT (church_id) DO NOTHING;
  RETURN QUERY SELECT * FROM public.visitor_portals WHERE church_id = p_church_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_visitor_portal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_visitor_portal(UUID) TO authenticated, service_role;

ALTER TABLE public.visitors ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'qr'));
CREATE INDEX idx_visitors_recent ON public.visitors(church_id, created_at DESC);
DROP POLICY IF EXISTS visitors_admin ON public.visitors;
CREATE POLICY visitors_admin ON public.visitors FOR ALL
  USING (public.is_visitor_admin(church_id)) WITH CHECK (public.is_visitor_admin(church_id));
DROP POLICY IF EXISTS visitor_followups_admin ON public.visitor_followups;
CREATE POLICY visitor_followups_admin ON public.visitor_followups FOR ALL
  USING (EXISTS (SELECT 1 FROM public.visitors v
    WHERE v.id = visitor_id AND public.is_visitor_admin(v.church_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.visitors v
    WHERE v.id = visitor_id AND public.is_visitor_admin(v.church_id)));

CREATE FUNCTION public.validate_visitor_record()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.church_id IS DISTINCT FROM OLD.church_id) THEN
    RAISE EXCEPTION 'A visitor cannot be moved to another church' USING ERRCODE = '22023';
  END IF;
  NEW.full_name := btrim(NEW.full_name);
  NEW.phone := nullif(btrim(NEW.phone), '');
  NEW.email := nullif(lower(btrim(NEW.email)), '');
  NEW.status := coalesce(NEW.status, 'new');
  IF NEW.full_name IS NULL OR NEW.full_name !~ '[^[:space:]]' OR char_length(NEW.full_name) > 160 THEN
    RAISE EXCEPTION 'Enter a full name of up to 160 characters' USING ERRCODE = '22023';
  END IF;
  IF NEW.phone IS NOT NULL AND NEW.phone !~ '^\+?[0-9 ()-]{6,32}$' THEN
    RAISE EXCEPTION 'Enter a valid phone number' USING ERRCODE = '22023';
  END IF;
  IF NEW.email IS NOT NULL AND (char_length(NEW.email) > 254 OR NEW.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE = '22023';
  END IF;
  IF NEW.status NOT IN ('new', 'contacted', 'follow_up', 'converted', 'cold') OR char_length(NEW.notes) > 5000 THEN
    RAISE EXCEPTION 'Invalid visitor status or notes' USING ERRCODE = '22023';
  END IF;
  IF (NEW.invited_by_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.church_memberships WHERE id = NEW.invited_by_membership_id AND church_id = NEW.church_id
  )) OR (NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.church_memberships WHERE id = NEW.assigned_to AND church_id = NEW.church_id
  )) THEN
    RAISE EXCEPTION 'The membership must belong to this visitor''s church' USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_visitor BEFORE INSERT OR UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.validate_visitor_record();

CREATE FUNCTION public.validate_visitor_followup()
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
      AND m.role = 'super_admin' AND m.status = 'active'
      AND (auth.uid() IS NULL OR m.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'The follow-up author must be a super admin of this church' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_visitor_followup BEFORE INSERT OR UPDATE ON public.visitor_followups
  FOR EACH ROW EXECUTE FUNCTION public.validate_visitor_followup();

CREATE TABLE public.visitor_sessions (
  token_hash TEXT PRIMARY KEY,
  portal_token UUID NOT NULL REFERENCES public.visitor_portals(token) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visitor_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.visitor_sessions TO service_role;

CREATE TABLE public.visitor_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000 AND body ~ '[^[:space:]]'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (visitor_id, submission_id)
);
CREATE INDEX idx_visitor_comments_recent ON public.visitor_comments(visitor_id, created_at DESC);
ALTER TABLE public.visitor_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visitor_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.visitor_comments TO authenticated;
GRANT ALL ON public.visitor_comments TO service_role;
CREATE POLICY visitor_comments_read ON public.visitor_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.visitors v
    WHERE v.id = visitor_id AND public.is_visitor_admin(v.church_id)));
CREATE POLICY visitor_comments_delete ON public.visitor_comments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.visitors v
    WHERE v.id = visitor_id AND public.is_visitor_admin(v.church_id)));

CREATE FUNCTION public.get_visitor_welcome(p_token UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('church_id', c.id, 'church_name', c.name,
    'church_username', c.username, 'logo_url', c.logo_url, 'welcome_message', p.welcome_message)
  FROM public.visitor_portals p JOIN public.churches c ON c.id = p.church_id
  WHERE p.token = p_token;
$$;

-- The random 256-bit token is generated by the submitting client. Retrying the
-- same submission returns the same record; only its hash is stored in Postgres.
CREATE FUNCTION public.register_church_visitor(
  p_token UUID, p_full_name TEXT, p_session_token TEXT,
  p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL, p_comment TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_church UUID;
  v_visitor UUID;
  v_hash TEXT;
  v_session public.visitor_sessions%ROWTYPE;
BEGIN
  SELECT church_id INTO v_church FROM public.visitor_portals WHERE token = p_token;
  IF v_church IS NULL THEN
    RAISE EXCEPTION 'This visitor welcome link was not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_session_token IS NULL OR p_session_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid visitor session' USING ERRCODE = '22023';
  END IF;
  IF char_length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'Comments must be at most 2000 characters' USING ERRCODE = '22023';
  END IF;
  v_hash := encode(digest(p_session_token, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('visitor:' || v_hash, 0));
  SELECT * INTO v_session FROM public.visitor_sessions WHERE token_hash = v_hash;
  IF FOUND THEN
    IF v_session.portal_token <> p_token OR v_session.expires_at <= NOW() THEN
      RAISE EXCEPTION 'This visitor session is invalid or expired' USING ERRCODE = '42501';
    END IF;
    RETURN v_session.visitor_id;
  END IF;
  INSERT INTO public.visitors(church_id, full_name, phone, email, source, first_visit_date, status)
    VALUES (v_church, p_full_name, p_phone, p_email, 'qr', CURRENT_DATE, 'new') RETURNING id INTO v_visitor;
  INSERT INTO public.visitor_sessions(token_hash, portal_token, visitor_id)
    VALUES (v_hash, p_token, v_visitor);
  IF nullif(btrim(p_comment), '') IS NOT NULL AND p_comment ~ '[^[:space:]]' THEN
    INSERT INTO public.visitor_comments(visitor_id, submission_id, body)
      VALUES (v_visitor, gen_random_uuid(), btrim(p_comment));
  END IF;
  RETURN v_visitor;
END;
$$;

CREATE FUNCTION public.get_visitor_portal(p_token UUID, p_session_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_visitor public.visitors%ROWTYPE;
BEGIN
  SELECT v.* INTO v_visitor FROM public.visitor_sessions s
    JOIN public.visitors v ON v.id = s.visitor_id
    JOIN public.visitor_portals p ON p.token = s.portal_token AND p.church_id = v.church_id
    WHERE s.portal_token = p_token AND s.expires_at > NOW()
      AND s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex');
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'visitor', jsonb_build_object('full_name', v_visitor.full_name),
    'comments', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC) FROM (
      SELECT id, body, created_at FROM public.visitor_comments WHERE visitor_id = v_visitor.id
      ORDER BY created_at DESC LIMIT 50
    ) c), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.start_time) FROM (
      SELECT id, title, description, start_time, end_time, location_name
      FROM public.events WHERE church_id = v_visitor.church_id
        AND visibility = 'public' AND status = 'published'
        AND coalesce(end_time, start_time + INTERVAL '1 day') >= NOW()
    ) e), '[]'::jsonb),
    'services', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.day_of_week, r.title) FROM (
      SELECT id, title, description, day_of_week, times, timezone, location_name
      FROM public.recurring_services WHERE church_id = v_visitor.church_id
        AND visibility = 'public' AND is_active AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ) r), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.add_visitor_comment(
  p_token UUID, p_session_token TEXT, p_body TEXT, p_submission_id UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_visitor UUID;
  v_comment UUID;
BEGIN
  -- Lock the session so simultaneous comment submissions share the rate limit.
  SELECT s.visitor_id INTO v_visitor FROM public.visitor_sessions s
    JOIN public.visitors v ON v.id = s.visitor_id
    JOIN public.visitor_portals p ON p.token = s.portal_token AND p.church_id = v.church_id
    WHERE s.portal_token = p_token AND s.expires_at > NOW()
      AND s.token_hash = encode(digest(p_session_token, 'sha256'), 'hex') FOR UPDATE OF s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Please register before leaving a comment' USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000
    OR p_submission_id IS NULL THEN
    RAISE EXCEPTION 'Enter a comment of up to 2000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_comment FROM public.visitor_comments
    WHERE visitor_id = v_visitor AND submission_id = p_submission_id;
  IF FOUND THEN RETURN v_comment; END IF;
  IF (SELECT count(*) FROM public.visitor_comments
    WHERE visitor_id = v_visitor AND created_at > NOW() - INTERVAL '10 minutes') >= 10 THEN
    RAISE EXCEPTION 'Please wait a few minutes before sending another comment' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.visitor_comments(visitor_id, submission_id, body)
    VALUES (v_visitor, p_submission_id, btrim(p_body)) RETURNING id INTO v_comment;
  RETURN v_comment;
END;
$$;

REVOKE ALL ON FUNCTION public.get_visitor_welcome(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_church_visitor(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_visitor_portal(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_visitor_comment(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visitor_welcome(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_church_visitor(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_visitor_portal(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_visitor_comment(UUID, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
