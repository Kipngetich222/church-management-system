-- ============================================
-- 0016_church_username_immutable.sql
-- ============================================
--
-- A church's username is its permanent public identifier: it is chosen once
-- (during onboarding / church creation) and is never editable afterwards. The
-- profile form no longer sends it, but nothing stops another client (or a
-- direct API call) from updating the column. Guard it at the database so the
-- invariant holds no matter which client writes.

CREATE OR REPLACE FUNCTION public.prevent_church_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'A church username cannot be changed once it has been set.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS churches_username_immutable ON public.churches;

CREATE TRIGGER churches_username_immutable
  BEFORE UPDATE ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_church_username_change();
