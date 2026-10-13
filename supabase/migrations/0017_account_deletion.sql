-- ============================================
-- 0017_account_deletion.sql
-- ============================================
--
-- Two account-deletion flows with reversible safety windows:
--
--   1. A member deleting their own account (Danger zone on the member
--      profile). Deleting the auth user cascades to public.users, which
--      cascades to public.church_memberships, so every church the member
--      belonged to automatically drops by one. The member gets a 10 minute
--      window to revert before the account is deleted permanently.
--
--   2. A church deleting its account (Danger zone under super-admin settings).
--      Every super admin of the church must accept the deletion. Once all have
--      accepted, the super admins get a 24 hour window to revert before the
--      church is deleted permanently (which detaches all members via cascade).
--
-- `deletion_events` is an append-only tracker that survives the very deletion
-- it records (it holds ids without foreign keys to the removed rows), so admins
-- and the platform keep a permanent record of these activities.

-- --------------------------------------------
-- MEMBER DELETE REQUESTS
-- --------------------------------------------
CREATE TABLE public.member_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reverted', 'completed')),
  reason TEXT,
  memberships_removed INT NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revert_deadline TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_member_deletion_status
  ON public.member_deletion_requests(status, revert_deadline);
CREATE UNIQUE INDEX idx_member_deletion_pending
  ON public.member_deletion_requests(user_id)
  WHERE status = 'pending';

-- --------------------------------------------
-- CHURCH DELETE REQUESTS
-- --------------------------------------------
CREATE TABLE public.church_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL,
  church_name TEXT NOT NULL,
  church_username TEXT,
  initiated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'reverted', 'rejected', 'completed')),
  total_super_admins INT NOT NULL DEFAULT 0,
  approvals_required INT NOT NULL DEFAULT 0,
  approvals_granted INT NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revert_deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_church_deletion_status
  ON public.church_deletion_requests(status, revert_deadline);
CREATE UNIQUE INDEX idx_church_deletion_active
  ON public.church_deletion_requests(church_id)
  WHERE status IN ('pending_approval', 'approved');

-- --------------------------------------------
-- CHURCH DELETE APPROVALS
-- --------------------------------------------
CREATE TABLE public.church_deletion_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.church_deletion_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'rejected')),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, approver_id)
);

CREATE INDEX idx_church_deletion_approvals_request
  ON public.church_deletion_approvals(request_id);

-- --------------------------------------------
-- DELETION EVENTS (permanent, deletion-safe tracker)
-- --------------------------------------------
CREATE TABLE public.deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('member', 'church')),
  action TEXT NOT NULL,
  church_id UUID,
  church_name TEXT,
  subject_user_id UUID,
  subject_name TEXT,
  subject_email TEXT,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deletion_events_created
  ON public.deletion_events(created_at DESC);
CREATE INDEX idx_deletion_events_church
  ON public.deletion_events(church_id);

-- --------------------------------------------
-- ROW LEVEL SECURITY
-- --------------------------------------------
-- All mutations run through the service role (Next.js API routes / NestJS API),
-- which bypasses RLS. These policies only govern reads from user-scoped clients.
ALTER TABLE public.member_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_deletion_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_events ENABLE ROW LEVEL SECURITY;

-- Members can read their own deletion request.
CREATE POLICY "member_deletion_read_own" ON public.member_deletion_requests
  FOR SELECT USING (user_id = auth.uid());

-- Super admins can read the deletion request for their church.
CREATE POLICY "church_deletion_read_super_admin" ON public.church_deletion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.church_memberships
      WHERE user_id = auth.uid()
        AND church_id = church_deletion_requests.church_id
        AND role = 'super_admin'
    )
  );

-- Super admins can read the approvals for their church's deletion request.
CREATE POLICY "church_deletion_approvals_read" ON public.church_deletion_approvals
  FOR SELECT USING (
    approver_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.church_deletion_requests r
      JOIN public.church_memberships cm
        ON cm.church_id = r.church_id
      WHERE r.id = church_deletion_approvals.request_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'super_admin'
    )
  );

-- Subjects and church super admins can read the permanent event trail.
CREATE POLICY "deletion_events_read" ON public.deletion_events
  FOR SELECT USING (
    subject_user_id = auth.uid()
    OR (
      church_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.church_memberships
        WHERE user_id = auth.uid()
          AND church_id = deletion_events.church_id
          AND role = 'super_admin'
      )
    )
  );
