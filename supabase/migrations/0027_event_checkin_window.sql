-- ============================================
-- 0027_event_checkin_window.sql
-- Members may only check in once the event has started.
--
-- The member UI already hides the check-in button until the event's start
-- time, but this trigger enforces the rule at the database so nobody can
-- check in early by hitting the API directly.
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_event_checkin_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.events%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;

  IF ev.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Church admins recording attendance manually and service-role jobs are not
  -- bound by the member check-in window.
  IF auth.role() = 'service_role' OR public.is_church_admin(ev.church_id) THEN
    RETURN NEW;
  END IF;

  IF NOW() < ev.start_time THEN
    RAISE EXCEPTION 'Check-in opens when the event starts'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_attendance_window ON public.event_attendance;

CREATE TRIGGER trg_event_attendance_window
BEFORE INSERT ON public.event_attendance
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_checkin_window();
