-- ============================================
-- 0020_membership_withdrawal_role_transfer.sql
-- ============================================
--
-- Members can now withdraw from a single church without deleting their whole
-- account, then browse and join another church. The interesting case is a
-- super admin leaving: a church must never be left without an owner.
--
-- `withdraw_membership` runs atomically and, when the departing member is the
-- last super admin, hands ownership to another leader before removing them:
--   1. a department admin / leader (role = dept_admin),
--   2. a department leader (department_members.is_leader),
--   3. a small-group leader,
--   4. any other active member,
--   5. otherwise the church has no one left and is deleted.
--
-- The same function backs account deletion so a deleted super admin transfers
-- ownership instead of orphaning the church. It also acts as an orphan guard:
-- if a church is left with zero members for any reason it is removed.

-- Allow membership-level events in the permanent deletion tracker.
ALTER TABLE public.deletion_events
  DROP CONSTRAINT IF EXISTS deletion_events_kind_check;
ALTER TABLE public.deletion_events
  ADD CONSTRAINT deletion_events_kind_check
  CHECK (kind IN ('member', 'church', 'membership'));

-- --------------------------------------------
-- PICK A SUCCESSOR FOR A VACANT SUPER ADMIN SEAT
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.select_super_admin_successor(
  p_church_id uuid,
  p_exclude_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Tier 1: a department admin (role = dept_admin).
  SELECT cm.id INTO v_id
  FROM public.church_memberships cm
  WHERE cm.church_id = p_church_id
    AND cm.user_id <> p_exclude_user_id
    AND cm.role = 'dept_admin'
    AND COALESCE(cm.status, 'active') = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.member_deletion_requests d
      WHERE d.user_id = cm.user_id AND d.status = 'pending'
    )
  ORDER BY random()
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Tier 2: a department leader.
  SELECT cm.id INTO v_id
  FROM public.church_memberships cm
  JOIN public.department_members dm
    ON dm.membership_id = cm.id AND dm.is_leader = TRUE
  WHERE cm.church_id = p_church_id
    AND cm.user_id <> p_exclude_user_id
    AND COALESCE(cm.status, 'active') = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.member_deletion_requests d
      WHERE d.user_id = cm.user_id AND d.status = 'pending'
    )
  ORDER BY random()
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Tier 3: a small-group leader.
  SELECT cm.id INTO v_id
  FROM public.church_memberships cm
  JOIN public.small_groups sg ON sg.leader_membership_id = cm.id
  WHERE cm.church_id = p_church_id
    AND cm.user_id <> p_exclude_user_id
    AND COALESCE(cm.status, 'active') = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.member_deletion_requests d
      WHERE d.user_id = cm.user_id AND d.status = 'pending'
    )
  ORDER BY random()
  LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- Tier 4: any other active member.
  SELECT cm.id INTO v_id
  FROM public.church_memberships cm
  WHERE cm.church_id = p_church_id
    AND cm.user_id <> p_exclude_user_id
    AND COALESCE(cm.status, 'active') = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.member_deletion_requests d
      WHERE d.user_id = cm.user_id AND d.status = 'pending'
    )
  ORDER BY random()
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- --------------------------------------------
-- WITHDRAW A MEMBERSHIP (leave one church)
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_membership(
  p_user_id uuid,
  p_church_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership     public.church_memberships%ROWTYPE;
  v_super_count    int;
  v_member_count   int;
  v_successor_id   uuid;
  v_successor_user uuid;
  v_successor_name text;
  v_church_name    text;
BEGIN
  -- Lock the church's memberships so two simultaneous departures cannot both
  -- believe they are the last super admin.
  PERFORM 1 FROM public.church_memberships
    WHERE church_id = p_church_id
    FOR UPDATE;

  SELECT * INTO v_membership
  FROM public.church_memberships
  WHERE user_id = p_user_id AND church_id = p_church_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_a_member');
  END IF;

  SELECT name INTO v_church_name FROM public.churches WHERE id = p_church_id;

  SELECT count(*) INTO v_member_count
  FROM public.church_memberships WHERE church_id = p_church_id;

  IF v_membership.role = 'super_admin' THEN
    SELECT count(*) INTO v_super_count
    FROM public.church_memberships
    WHERE church_id = p_church_id AND role = 'super_admin';

    IF v_super_count <= 1 THEN
      v_successor_id := public.select_super_admin_successor(p_church_id, p_user_id);

      IF v_successor_id IS NULL THEN
        -- Nobody left to hand the church to: remove it entirely.
        DELETE FROM public.churches WHERE id = p_church_id;
        RETURN jsonb_build_object(
          'status', 'church_deleted',
          'church_id', p_church_id,
          'church_name', v_church_name,
          'members_removed', v_member_count
        );
      END IF;

      UPDATE public.church_memberships
        SET role = 'super_admin'
        WHERE id = v_successor_id
        RETURNING user_id INTO v_successor_user;

      SELECT full_name INTO v_successor_name
      FROM public.users WHERE id = v_successor_user;
    END IF;
  END IF;

  DELETE FROM public.church_memberships WHERE id = v_membership.id;

  -- Orphan guard: a church with no members left is meaningless, so remove it.
  IF v_member_count - 1 <= 0 THEN
    DELETE FROM public.churches WHERE id = p_church_id;
    RETURN jsonb_build_object(
      'status', 'church_deleted',
      'church_id', p_church_id,
      'church_name', v_church_name,
      'members_removed', v_member_count
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'left',
    'church_id', p_church_id,
    'church_name', v_church_name,
    'role', v_membership.role,
    'members_remaining', v_member_count - 1,
    'promoted_membership_id', v_successor_id,
    'promoted_user_id', v_successor_user,
    'promoted_name', v_successor_name
  );
END;
$$;

-- --------------------------------------------
-- LOCK DOWN EXECUTION
-- --------------------------------------------
-- These functions bypass RLS and transfer ownership / delete churches, so they
-- must only ever run through the trusted API (service role). Default EXECUTE is
-- granted to PUBLIC, which would let any authenticated client call them with an
-- arbitrary user id - remove that and grant the service role instead.
REVOKE ALL ON FUNCTION public.withdraw_membership(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.select_super_admin_successor(uuid, uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.withdraw_membership(uuid, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.select_super_admin_successor(uuid, uuid) TO service_role;
  END IF;
END;
$$;