-- Keep existing shifts and signups while expanding them into church activities.
ALTER TABLE public.volunteer_shifts
  ADD COLUMN category TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN recurrence_until DATE,
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ALTER COLUMN slots DROP NOT NULL,
  ALTER COLUMN slots DROP DEFAULT;

-- NOT VALID preserves legacy rows. New writes must provide complete details.
ALTER TABLE public.volunteer_shifts
  ADD CONSTRAINT volunteer_title CHECK (length(btrim(title)) BETWEEN 1 AND 200) NOT VALID,
  ADD CONSTRAINT volunteer_venue CHECK (location IS NOT NULL AND length(btrim(location)) BETWEEN 1 AND 300) NOT VALID,
  ADD CONSTRAINT volunteer_times CHECK (ends_at > starts_at) NOT VALID,
  ADD CONSTRAINT volunteer_capacity CHECK (slots IS NULL OR slots > 0) NOT VALID,
  ADD CONSTRAINT volunteer_category CHECK (category IN ('cleaning', 'compound', 'gardening', 'community', 'other')),
  ADD CONSTRAINT volunteer_recurrence CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly'));

-- Calendar arithmetic uses the activity's timezone, including across DST.
-- Monthly activities use the original day, clamped to short months (Jan 31 -> Feb 28 -> Mar 31).
CREATE FUNCTION public.volunteer_next_occurrence(
  p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_recurrence TEXT,
  p_until DATE, p_timezone TEXT, p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (next_starts_at TIMESTAMPTZ, next_ends_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  local_start TIMESTAMP := p_start AT TIME ZONE p_timezone;
  local_end TIMESTAMP := p_end AT TIME ZONE p_timezone;
  local_now TIMESTAMP := p_now AT TIME ZONE p_timezone;
  occurrence TIMESTAMP;
  step INTEGER := 0;
  span INTEGER;
BEGIN
  IF p_recurrence = 'none' THEN
    IF p_end > p_now THEN
      RETURN QUERY SELECT p_start, p_end;
    END IF;
    RETURN;
  END IF;
  IF p_recurrence = 'monthly' THEN
    step := GREATEST(0, (EXTRACT(YEAR FROM local_now)::INT - EXTRACT(YEAR FROM local_start)::INT) * 12
      + EXTRACT(MONTH FROM local_now)::INT - EXTRACT(MONTH FROM local_start)::INT);
  ELSE
    span := CASE WHEN p_recurrence = 'weekly' THEN 7 ELSE 1 END;
    step := GREATEST(0, (local_now::DATE - local_start::DATE) / span);
  END IF;
  LOOP
    occurrence := local_start + CASE WHEN p_recurrence = 'monthly'
      THEN pg_catalog.make_interval(months => step)
      ELSE pg_catalog.make_interval(days => step * span) END;
    IF p_until IS NOT NULL AND occurrence::DATE > p_until THEN RETURN; END IF;
    next_starts_at := occurrence AT TIME ZONE p_timezone;
    next_ends_at := (occurrence + (local_end - local_start)) AT TIME ZONE p_timezone;
    IF next_ends_at > p_now THEN RETURN NEXT; RETURN; END IF;
    step := step + 1;
  END LOOP;
END;
$$;

CREATE FUNCTION public.validate_volunteer_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.church_id <> OLD.church_id THEN
    RAISE EXCEPTION 'An activity cannot be moved to another church' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Choose a valid activity timezone' USING ERRCODE = '23514';
  END IF;
  IF NEW.recurrence = 'none' AND NEW.recurrence_until IS NOT NULL THEN
    RAISE EXCEPTION 'One-time activities cannot have a recurrence end date' USING ERRCODE = '23514';
  END IF;
  IF NEW.recurrence <> 'none' AND (
    (NEW.ends_at AT TIME ZONE NEW.timezone)::DATE <> (NEW.starts_at AT TIME ZONE NEW.timezone)::DATE
    OR NEW.recurrence_until < (NEW.starts_at AT TIME ZONE NEW.timezone)::DATE
  ) THEN
    RAISE EXCEPTION 'Recurring sessions must finish on the same day and repeat until the first date or later' USING ERRCODE = '23514';
  END IF;
  IF NEW.role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.volunteer_roles WHERE id = NEW.role_id AND church_id = NEW.church_id
  ) THEN
    RAISE EXCEPTION 'The volunteer role must belong to this church' USING ERRCODE = '23514';
  END IF;
  IF NEW.event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.events WHERE id = NEW.event_id AND church_id = NEW.church_id
  ) THEN
    RAISE EXCEPTION 'The linked event must belong to this church' USING ERRCODE = '23514';
  END IF;
  IF NEW.slots IS NOT NULL AND NEW.slots < (
    SELECT count(*) FROM public.volunteer_signups WHERE shift_id = NEW.id AND COALESCE(status, 'confirmed') = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'The participant limit cannot be lower than the current participant count' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_volunteer_activity BEFORE INSERT OR UPDATE ON public.volunteer_shifts
FOR EACH ROW EXECUTE FUNCTION public.validate_volunteer_activity();

-- Serialize signups on the parent activity so simultaneous requests cannot overbook.
-- This also protects service-role API writes, which bypass RLS.
CREATE FUNCTION public.validate_volunteer_signup()
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
    WHERE id = NEW.membership_id AND church_id = activity.church_id AND status = 'active'
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
CREATE TRIGGER validate_volunteer_signup BEFORE INSERT OR UPDATE ON public.volunteer_signups
FOR EACH ROW EXECUTE FUNCTION public.validate_volunteer_signup();

DROP POLICY vol_signups_self_write ON public.volunteer_signups;
CREATE POLICY vol_signups_self_write ON public.volunteer_signups FOR INSERT TO authenticated
WITH CHECK (
  COALESCE(status, 'confirmed') = 'confirmed'
  AND EXISTS (
    SELECT 1 FROM public.church_memberships m JOIN public.volunteer_shifts s ON s.church_id = m.church_id
    WHERE m.id = membership_id AND m.user_id = auth.uid() AND m.status = 'active' AND s.id = shift_id
  )
);

-- Members see accurate totals without receiving other participants' identities.
CREATE FUNCTION public.get_volunteer_activities(p_church_id UUID)
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
  WHERE m.church_id = p_church_id AND m.user_id = auth.uid() AND m.status = 'active';
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

-- Changes to recurrence, instructions, or availability also notify participants.
CREATE OR REPLACE FUNCTION public.notify_volunteer_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  activity public.volunteer_shifts%ROWTYPE;
  signup public.volunteer_signups%ROWTYPE;
  signup_status TEXT;
  recipients UUID[];
BEGIN
  IF TG_TABLE_NAME = 'volunteer_signups' THEN
    IF TG_OP = 'DELETE' THEN
      signup := OLD;
      signup_status := 'cancelled';
      IF OLD.status = 'cancelled' THEN RETURN OLD; END IF;
    ELSE
      IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
      signup := NEW;
      signup_status := COALESCE(NEW.status, 'confirmed');
    END IF;
    SELECT * INTO activity FROM public.volunteer_shifts WHERE id = signup.shift_id;
    IF FOUND THEN
      PERFORM public.deliver_notification(activity.church_id, 'volunteer_signup', 'volunteer_shifts', activity.id,
        'volunteer-signup:' || signup.id || ':' || gen_random_uuid(),
        'Volunteer signup: ' || activity.title,
        'Your signup is ' || signup_status || '.', ARRAY[signup.membership_id]);
    END IF;
  ELSE
    IF (NEW.starts_at, NEW.ends_at, NEW.location, NEW.title, NEW.recurrence, NEW.recurrence_until, NEW.timezone, NEW.is_active, NEW.notes)
      IS NOT DISTINCT FROM (OLD.starts_at, OLD.ends_at, OLD.location, OLD.title, OLD.recurrence, OLD.recurrence_until, OLD.timezone, OLD.is_active, OLD.notes)
      THEN RETURN NEW; END IF;
    SELECT COALESCE(array_agg(membership_id), '{}'::UUID[]) INTO recipients
    FROM public.volunteer_signups WHERE shift_id = NEW.id AND COALESCE(status, 'confirmed') IN ('confirmed', 'waitlist');
    PERFORM public.deliver_notification(NEW.church_id, 'volunteer_updated', 'volunteer_shifts', NEW.id,
      'volunteer-activity:' || NEW.id || ':' || gen_random_uuid(), 'Volunteer activity updated: ' || NEW.title,
      'The details of your volunteer activity have changed. Please review the schedule and instructions.', recipients);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_volunteer_activity(), public.validate_volunteer_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_volunteer_activities(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_volunteer_activities(UUID) TO authenticated;
