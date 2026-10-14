-- ============================================
-- 0021_plan_tiers.sql
-- ============================================
-- Pricing is refactored around church size instead of feature gating:
--   starter -> up to 200 members, KSh 2,500 / month
--   growth  -> more than 200 members, KSh 5,500 / month
-- Every plan unlocks every feature. The only difference is member capacity.
--
-- We keep the existing plan_tier enum but rename its values in place, so all
-- existing rows, column defaults and casts follow along automatically.

ALTER TYPE plan_tier RENAME VALUE 'basic' TO 'starter';
ALTER TYPE plan_tier RENAME VALUE 'premium' TO 'growth';

ALTER TABLE public.churches ALTER COLUMN plan SET DEFAULT 'starter';

-- --------------------------------------------
-- MEMBER CAPACITY
-- --------------------------------------------
-- Starter churches are capped at 200 memberships (members and admins counted
-- together). Growth churches have no cap. NULL means no limit.
CREATE OR REPLACE FUNCTION public.plan_member_limit(p_plan plan_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_plan = 'growth' THEN NULL ELSE 200 END;
$$;

-- Enforce the cap on every membership insert, no matter which code path (or
-- client) performs it. BEFORE INSERT + SECURITY DEFINER so the count is not
-- filtered by the caller RLS policies.
CREATE OR REPLACE FUNCTION public.enforce_church_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan plan_tier;
  v_limit integer;
  v_count integer;
BEGIN
  SELECT plan INTO v_plan FROM public.churches WHERE id = NEW.church_id;
  v_limit := public.plan_member_limit(v_plan);

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.church_memberships
  WHERE church_id = NEW.church_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'This church has reached the % member limit for its plan.', v_limit
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade the church to the Growth plan to add more members.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_church_member_limit ON public.church_memberships;
CREATE TRIGGER trg_enforce_church_member_limit
  BEFORE INSERT ON public.church_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_church_member_limit();

-- Convenience reader for the app layer: plan, cap and current usage.
CREATE OR REPLACE FUNCTION public.get_church_plan_usage(p_church_id uuid)
RETURNS TABLE (plan plan_tier, member_limit integer, member_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.plan,
    public.plan_member_limit(c.plan),
    (SELECT count(*) FROM public.church_memberships m WHERE m.church_id = c.id)
  FROM public.churches c
  WHERE c.id = p_church_id;
$$;

-- Only the server (service role) reads usage; keep the member counts off the
-- public API surface.
REVOKE EXECUTE ON FUNCTION public.get_church_plan_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_church_plan_usage(uuid) TO service_role;
