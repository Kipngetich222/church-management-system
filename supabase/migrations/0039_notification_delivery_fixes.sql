-- Each real signup transition needs its own notification, including returning
-- to a previous status. Web and API cancellation both delete the signup row.
CREATE OR REPLACE FUNCTION public.notify_volunteer_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  shift public.volunteer_shifts%ROWTYPE;
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

    SELECT * INTO shift FROM public.volunteer_shifts WHERE id = signup.shift_id;
    -- A cascade from deleting the shift must not try to notify a dead source.
    IF FOUND THEN
      PERFORM public.deliver_notification(shift.church_id, 'volunteer_signup', 'volunteer_shifts', shift.id,
        'volunteer-signup:' || signup.id || ':' || gen_random_uuid(),
        'Volunteer signup: ' || shift.title,
        'Your signup is ' || signup_status || '.', ARRAY[signup.membership_id]);
    END IF;
  ELSE
    IF (NEW.starts_at, NEW.ends_at, NEW.location, NEW.title)
      IS NOT DISTINCT FROM (OLD.starts_at, OLD.ends_at, OLD.location, OLD.title) THEN RETURN NEW; END IF;
    SELECT COALESCE(array_agg(membership_id), '{}'::UUID[]) INTO recipients
    FROM public.volunteer_signups WHERE shift_id = NEW.id AND COALESCE(status, 'confirmed') IN ('confirmed', 'waitlist');
    PERFORM public.deliver_notification(NEW.church_id, 'volunteer_updated', 'volunteer_shifts', NEW.id,
      'volunteer-shift:' || NEW.id || ':' || gen_random_uuid(), 'Volunteer shift updated: ' || NEW.title,
      'The schedule or location of your volunteer shift has changed. Please review the details.', recipients);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER notifications_volunteer_signups ON public.volunteer_signups;
CREATE TRIGGER notifications_volunteer_signups AFTER INSERT OR UPDATE OR DELETE ON public.volunteer_signups
FOR EACH ROW EXECUTE FUNCTION public.notify_volunteer_change();
