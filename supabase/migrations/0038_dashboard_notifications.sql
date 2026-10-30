-- Persistent, recipient-scoped notifications shared by the web app and API.
-- Triggers run in the same transaction as the action they describe.

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'announcements', 'events', 'sermons', 'resources', 'church_memberships',
    'prayer_requests', 'volunteer_shifts', 'messages'
  )),
  source_id UUID NOT NULL,
  event_key TEXT NOT NULL,
  admin_only BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_recipient_membership_fkey
    FOREIGN KEY (recipient_id, church_id)
    REFERENCES public.church_memberships(user_id, church_id) ON DELETE CASCADE,
  UNIQUE (recipient_id, church_id, event_key)
);

CREATE INDEX notifications_inbox_idx
  ON public.notifications(recipient_id, church_id, created_at DESC, id DESC);
CREATE INDEX notifications_unread_idx
  ON public.notifications(recipient_id, church_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX notifications_source_idx
  ON public.notifications(source_type, source_id);

-- SECURITY INVOKER deliberately reuses the source tables' RLS. Changing an
-- event's audience, revoking an assignment or removing a source also removes
-- access to its notification, even if it was delivered earlier.
CREATE FUNCTION public.notification_source_visible(
  p_church_id UUID, p_source_type TEXT, p_source_id UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE p_source_type
    WHEN 'announcements' THEN EXISTS (
      SELECT 1 FROM public.announcements
      WHERE id = p_source_id AND church_id = p_church_id AND published = TRUE
    )
    WHEN 'events' THEN EXISTS (
      SELECT 1 FROM public.events WHERE id = p_source_id AND church_id = p_church_id
    )
    WHEN 'sermons' THEN EXISTS (
      SELECT 1 FROM public.sermons
      WHERE id = p_source_id AND church_id = p_church_id AND published = TRUE
    )
    WHEN 'resources' THEN EXISTS (
      SELECT 1 FROM public.resources
      WHERE id = p_source_id AND church_id = p_church_id AND active = TRUE
        AND file_path IS NOT NULL
    )
    WHEN 'church_memberships' THEN EXISTS (
      SELECT 1 FROM public.church_memberships
      WHERE id = p_source_id AND church_id = p_church_id
    )
    WHEN 'prayer_requests' THEN EXISTS (
      SELECT 1 FROM public.prayer_requests
      WHERE id = p_source_id AND church_id = p_church_id
    )
    WHEN 'volunteer_shifts' THEN EXISTS (
      SELECT 1 FROM public.volunteer_shifts
      WHERE id = p_source_id AND church_id = p_church_id
    )
    WHEN 'messages' THEN EXISTS (
      SELECT 1 FROM public.messages
      WHERE id = p_source_id AND church_id = p_church_id
    )
    ELSE FALSE
  END;
$$;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_read_own ON public.notifications
FOR SELECT TO authenticated USING (
  recipient_id = (SELECT auth.uid())
  AND (NOT admin_only OR public.is_church_admin(church_id))
  AND public.notification_source_visible(church_id, source_type, source_id)
);

CREATE POLICY notifications_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (
  recipient_id = (SELECT auth.uid())
  AND (NOT admin_only OR public.is_church_admin(church_id))
  AND public.notification_source_visible(church_id, source_type, source_id)
)
WITH CHECK (recipient_id = (SELECT auth.uid()));

-- Clients can only change read state, never manufacture notifications or
-- change their recipient, content, source, timestamps or church.
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

CREATE FUNCTION public.get_notifications(
  p_church_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_unread_only BOOLEAN DEFAULT FALSE,
  p_before_created_at TIMESTAMPTZ DEFAULT NULL,
  p_before_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.church_memberships
    WHERE user_id = auth.uid() AND church_id = p_church_id
  ) THEN
    RAISE EXCEPTION 'Church membership required' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50
    OR (p_before_created_at IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid notification pagination' USING ERRCODE = '22023';
  END IF;

  WITH page AS MATERIALIZED (
    SELECT n.* FROM public.notifications n
    WHERE n.church_id = p_church_id AND n.recipient_id = auth.uid()
      AND (NOT p_unread_only OR n.read_at IS NULL)
      AND (p_before_created_at IS NULL
        OR (n.created_at, n.id) < (p_before_created_at, p_before_id))
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT p_limit + 1
  ), items AS (
    SELECT * FROM page ORDER BY created_at DESC, id DESC LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC, i.id DESC) FROM items i), '[]'::jsonb),
    'has_more', (SELECT COUNT(*) > p_limit FROM page),
    'unread_count', (SELECT COUNT(*) FROM public.notifications
      WHERE church_id = p_church_id AND recipient_id = auth.uid() AND read_at IS NULL),
    'snapshot_at', NOW()
  ) INTO result;
  RETURN result;
END;
$$;

CREATE FUNCTION public.set_notification_read(
  p_church_id UUID, p_notification_id UUID, p_read BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_read IS NULL THEN
    RAISE EXCEPTION 'Authentication and read state required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notifications
  SET read_at = CASE WHEN p_read THEN COALESCE(read_at, NOW()) ELSE NULL END
  WHERE id = p_notification_id AND church_id = p_church_id AND recipient_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.mark_all_notifications_read(p_church_id UUID, p_before TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_before IS NULL THEN
    RAISE EXCEPTION 'Authentication and snapshot required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notifications SET read_at = NOW()
  WHERE church_id = p_church_id AND recipient_id = auth.uid() AND read_at IS NULL
    AND created_at <= LEAST(p_before, NOW());
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_source_visible(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_notifications(UUID, INTEGER, BOOLEAN, TIMESTAMPTZ, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_notification_read(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_source_visible(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notifications(UUID, INTEGER, BOOLEAN, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_notification_read(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID, TIMESTAMPTZ) TO authenticated;

-- Only database triggers can call this fan-out helper. Manual members without
-- an account are skipped, and the unique event key makes delivery idempotent.
CREATE FUNCTION public.deliver_notification(
  p_church_id UUID, p_kind TEXT, p_source_type TEXT, p_source_id UUID,
  p_event_key TEXT, p_title TEXT, p_body TEXT,
  p_membership_ids UUID[] DEFAULT NULL, p_admin_only BOOLEAN DEFAULT FALSE
)
RETURNS VOID LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.notifications (
    church_id, recipient_id, kind, source_type, source_id,
    event_key, title, body, admin_only
  )
  SELECT p_church_id, m.user_id, p_kind, p_source_type, p_source_id,
    p_event_key, p_title, p_body, p_admin_only
  FROM public.church_memberships m
  WHERE m.church_id = p_church_id AND m.user_id IS NOT NULL
    AND COALESCE(m.status, 'active') = 'active'
    AND (p_membership_ids IS NULL OR m.id = ANY(p_membership_ids))
    AND (NOT p_admin_only OR m.role IN ('super_admin', 'dept_admin'))
  ON CONFLICT (recipient_id, church_id, event_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.deliver_notification(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID[], BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.notify_published_content()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notification_kind TEXT;
  heading TEXT;
  content_title TEXT;
  content_body TEXT;
  visible_now BOOLEAN;
  visible_before BOOLEAN := FALSE;
BEGIN
  IF TG_TABLE_NAME = 'resources' THEN
    visible_now := NEW.active = TRUE AND NEW.file_path IS NOT NULL;
    IF TG_OP = 'UPDATE' THEN
      visible_before := OLD.active = TRUE AND OLD.file_path IS NOT NULL;
    END IF;
    notification_kind := 'resource';
    heading := 'New resource: ';
    content_title := NEW.name;
    content_body := COALESCE(NEW.description, 'A new file is available in your church resource library.');
  ELSE
    visible_now := NEW.published = TRUE;
    IF TG_OP = 'UPDATE' THEN visible_before := OLD.published = TRUE; END IF;
    content_title := NEW.title;
    IF TG_TABLE_NAME = 'announcements' THEN
      notification_kind := 'announcement';
      heading := 'Announcement: ';
      content_body := NEW.body;
    ELSE
      notification_kind := 'sermon';
      heading := 'New sermon: ';
      content_body := COALESCE(NEW.description, 'A new sermon is available to watch.');
    END IF;
  END IF;

  IF visible_now IS NOT TRUE THEN
    DELETE FROM public.notifications WHERE source_type = TG_TABLE_NAME AND source_id = NEW.id;
  ELSIF visible_before IS NOT TRUE THEN
    PERFORM public.deliver_notification(NEW.church_id, notification_kind,
      TG_TABLE_NAME, NEW.id, TG_TABLE_NAME || ':' || NEW.id,
      heading || content_title, content_body);
  ELSE
    -- Editing published content updates the copy without resetting read state
    -- or generating another alert for the same publication.
    UPDATE public.notifications SET title = heading || content_title, body = content_body
    WHERE source_type = TG_TABLE_NAME AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_announcements AFTER INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_published_content();
CREATE TRIGGER notifications_sermons AFTER INSERT OR UPDATE ON public.sermons
FOR EACH ROW EXECUTE FUNCTION public.notify_published_content();
CREATE TRIGGER notifications_resources AFTER INSERT OR UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.notify_published_content();

-- Church members need to open a cancellation alert for a formerly public
-- event. Cancelled events remain hidden from signed-out visitors.
CREATE POLICY events_cancelled_public_members ON public.events
FOR SELECT TO authenticated USING (
  status = 'cancelled' AND visibility = 'public'
  AND church_id IN (
    SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
  )
);

CREATE FUNCTION public.notify_event_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipients UUID[];
  notification_kind TEXT;
  heading TEXT;
  event_key TEXT;
BEGIN
  IF NEW.status = 'draft' THEN
    DELETE FROM public.notifications WHERE source_type = 'events' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.start_time < NOW() THEN RETURN NEW; END IF;
    notification_kind := 'event_published';
    heading := 'Upcoming event: ';
    event_key := 'event:' || NEW.id || ':published'
      || CASE WHEN TG_OP = 'UPDATE' THEN ':' || gen_random_uuid()::TEXT ELSE '' END;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status = 'published' THEN
    notification_kind := 'event_cancelled';
    heading := 'Event cancelled: ';
    event_key := 'event:' || NEW.id || ':cancelled:' || gen_random_uuid();
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'published'
    AND (NEW.start_time, NEW.end_time, NEW.location_name, NEW.meeting_link, NEW.title,
      NEW.visibility, NEW.visibility_department_id, NEW.visibility_group_id)
      IS DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.location_name, OLD.meeting_link, OLD.title,
        OLD.visibility, OLD.visibility_department_id, OLD.visibility_group_id) THEN
    IF NEW.start_time < NOW() THEN RETURN NEW; END IF;
    notification_kind := 'event_updated';
    heading := 'Event updated: ';
    event_key := 'event:' || NEW.id || ':updated:' || gen_random_uuid();
  ELSE
    RETURN NEW;
  END IF;

  -- Match the audience rules in 0026 before fan-out. Source RLS is checked
  -- again when reading, so later audience/department/role changes are safe.
  SELECT COALESCE(array_agg(m.id), '{}'::UUID[]) INTO recipients
  FROM public.church_memberships m
  LEFT JOIN public.users u ON u.id = m.user_id
  WHERE m.church_id = NEW.church_id AND (
    m.role IN ('super_admin', 'dept_admin')
    OR NEW.visibility IN ('members_only', 'all_members')
    OR (NEW.visibility = 'public' AND NEW.status IN ('published', 'cancelled'))
    OR (NEW.visibility = 'super_admins' AND m.role = 'super_admin')
    OR (NEW.visibility::TEXT IN ('men', 'women', 'youth') AND u.category::TEXT = NEW.visibility::TEXT)
    OR (NEW.visibility = 'department' AND EXISTS (
      SELECT 1 FROM public.department_members
      WHERE membership_id = m.id AND department_id = NEW.visibility_department_id
    ))
    OR (NEW.visibility = 'group' AND EXISTS (
      SELECT 1 FROM public.small_group_members
      WHERE membership_id = m.id AND group_id = NEW.visibility_group_id
    ))
  );
  PERFORM public.deliver_notification(NEW.church_id, notification_kind, 'events', NEW.id,
    event_key, heading || NEW.title,
    CASE WHEN NEW.status = 'cancelled' THEN 'This event has been cancelled.'
      ELSE 'Open the event for the latest schedule, location and registration details.' END,
    recipients);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_events AFTER INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_event_change();

CREATE FUNCTION public.notify_membership_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  church_name TEXT;
  admins UUID[];
BEGIN
  SELECT name INTO church_name FROM public.churches WHERE id = NEW.church_id;
  IF TG_OP = 'INSERT' OR (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL) THEN
    PERFORM public.deliver_notification(NEW.church_id, 'membership_welcome', 'church_memberships',
      NEW.id, 'membership:' || NEW.id || ':welcome', 'Welcome to ' || church_name,
      'Your church updates and personal notifications will appear here.', ARRAY[NEW.id]);
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(id), '{}'::UUID[]) INTO admins
    FROM public.church_memberships WHERE church_id = NEW.church_id AND id <> NEW.id;
    PERFORM public.deliver_notification(NEW.church_id, 'member_joined', 'church_memberships',
      NEW.id, 'membership:' || NEW.id || ':joined', 'A new member joined',
      'A member has been added to your church. Open their profile to welcome them.', admins, TRUE);
  ELSIF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM public.deliver_notification(NEW.church_id, 'role_changed', 'church_memberships', NEW.id,
      'membership:' || NEW.id || ':role:' || gen_random_uuid(), 'Your church role changed',
      'Your role is now ' || replace(NEW.role::TEXT, '_', ' ') || '.', ARRAY[NEW.id]);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_memberships AFTER INSERT OR UPDATE ON public.church_memberships
FOR EACH ROW EXECUTE FUNCTION public.notify_membership_change();

CREATE FUNCTION public.notify_prayer_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admins UUID[];
  request_label TEXT;
BEGIN
  request_label := CASE WHEN NEW.type = 'counseling' THEN 'counselling request' ELSE 'prayer request' END;
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(id), '{}'::UUID[]) INTO admins
    FROM public.church_memberships
    WHERE church_id = NEW.church_id AND id <> NEW.membership_id
      AND (NEW.assigned_to IS NULL OR id <> NEW.assigned_to);
    PERFORM public.deliver_notification(NEW.church_id, 'prayer_created', 'prayer_requests', NEW.id,
      'prayer:' || NEW.id || ':created', 'New ' || request_label,
      'A member has submitted a request for church leadership.', admins, TRUE);
  END IF;
  IF NEW.assigned_to IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM public.deliver_notification(NEW.church_id, 'prayer_assigned', 'prayer_requests', NEW.id,
      'prayer:' || NEW.id || ':assigned:' || gen_random_uuid(), 'A request was assigned to you',
      'You have been asked to help with a ' || request_label || '.', ARRAY[NEW.assigned_to]);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.deliver_notification(NEW.church_id, 'prayer_status', 'prayer_requests', NEW.id,
      'prayer:' || NEW.id || ':status:' || gen_random_uuid(), 'Your ' || request_label || ' was updated',
      'The status is now ' || replace(NEW.status::TEXT, '_', ' ') || '.', ARRAY[NEW.membership_id]);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_prayer_requests AFTER INSERT OR UPDATE ON public.prayer_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_prayer_change();

CREATE FUNCTION public.notify_prayer_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request public.prayer_requests%ROWTYPE;
  recipients UUID[];
BEGIN
  -- Internal pastoral notes never create member notifications or copy their text.
  IF COALESCE(NEW.is_internal, FALSE) THEN RETURN NEW; END IF;
  SELECT * INTO request FROM public.prayer_requests WHERE id = NEW.request_id;
  IF NEW.author_membership_id <> request.membership_id THEN
    recipients := ARRAY[request.membership_id];
  ELSE
    SELECT COALESCE(array_agg(id), '{}'::UUID[]) INTO recipients
    FROM public.church_memberships
    WHERE church_id = request.church_id AND id <> NEW.author_membership_id
      AND (id = request.assigned_to OR role IN ('super_admin', 'dept_admin'));
  END IF;
  PERFORM public.deliver_notification(request.church_id, 'prayer_reply', 'prayer_requests', request.id,
    'prayer-reply:' || NEW.id, 'New response to a request',
    'There is a new response in your prayer or counselling conversation.', recipients);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_prayer_replies AFTER INSERT ON public.prayer_interactions
FOR EACH ROW EXECUTE FUNCTION public.notify_prayer_reply();

CREATE FUNCTION public.notify_volunteer_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  shift public.volunteer_shifts%ROWTYPE;
  recipients UUID[];
BEGIN
  IF TG_TABLE_NAME = 'volunteer_signups' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    SELECT * INTO shift FROM public.volunteer_shifts WHERE id = NEW.shift_id;
    PERFORM public.deliver_notification(shift.church_id, 'volunteer_signup', 'volunteer_shifts', shift.id,
      'volunteer-signup:' || NEW.id || ':' || COALESCE(NEW.status, 'confirmed'),
      'Volunteer signup: ' || shift.title,
      'Your signup is ' || COALESCE(NEW.status, 'confirmed') || '.', ARRAY[NEW.membership_id]);
  ELSE
    IF (NEW.starts_at, NEW.ends_at, NEW.location, NEW.title)
      IS NOT DISTINCT FROM (OLD.starts_at, OLD.ends_at, OLD.location, OLD.title) THEN RETURN NEW; END IF;
    SELECT COALESCE(array_agg(membership_id), '{}'::UUID[]) INTO recipients
    FROM public.volunteer_signups WHERE shift_id = NEW.id AND status IN ('confirmed', 'waitlist');
    PERFORM public.deliver_notification(NEW.church_id, 'volunteer_updated', 'volunteer_shifts', NEW.id,
      'volunteer-shift:' || NEW.id || ':' || gen_random_uuid(), 'Volunteer shift updated: ' || NEW.title,
      'The schedule or location of your volunteer shift has changed. Please review the details.', recipients);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_volunteer_signups AFTER INSERT OR UPDATE ON public.volunteer_signups
FOR EACH ROW EXECUTE FUNCTION public.notify_volunteer_change();
CREATE TRIGGER notifications_volunteer_shifts AFTER UPDATE ON public.volunteer_shifts
FOR EACH ROW EXECUTE FUNCTION public.notify_volunteer_change();

CREATE FUNCTION public.notify_delivered_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  subject TEXT;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('sent', 'delivered') OR NEW.membership_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('sent', 'delivered') THEN RETURN NEW; END IF;
  SELECT c.subject INTO subject FROM public.message_campaigns c
    WHERE c.id = NEW.campaign_id AND c.church_id = NEW.church_id;
  PERFORM public.deliver_notification(NEW.church_id, 'message', 'messages', NEW.id,
    'message:' || NEW.id, COALESCE(NULLIF(subject, ''), 'A message from your church'),
    NEW.body, ARRAY[NEW.membership_id]);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notifications_messages AFTER INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_delivered_message();

-- Source deletion removes retained copies of its content as well as dead links.
CREATE FUNCTION public.remove_source_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.notifications WHERE source_type = TG_TABLE_NAME AND source_id = OLD.id;
  RETURN OLD;
END;
$$;

DO $$
DECLARE
  source_name TEXT;
  function_name TEXT;
BEGIN
  FOREACH source_name IN ARRAY ARRAY['announcements', 'events', 'sermons', 'resources',
    'church_memberships', 'prayer_requests', 'volunteer_shifts', 'messages'] LOOP
    EXECUTE format('CREATE TRIGGER notifications_source_deleted AFTER DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.remove_source_notifications()', source_name);
  END LOOP;
  FOREACH function_name IN ARRAY ARRAY['notify_published_content', 'notify_event_change',
    'notify_membership_change', 'notify_prayer_change', 'notify_prayer_reply',
    'notify_volunteer_change', 'notify_delivered_message', 'remove_source_notifications'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated, service_role', function_name);
  END LOOP;
END;
$$;

-- No historical alerts are backfilled: existing members start with a clear
-- inbox, and newly published content/actions generate notifications immediately.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
