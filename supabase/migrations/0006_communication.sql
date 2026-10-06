-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE sms_status AS ENUM ('queued', 'sending', 'sent', 'failed', 'delivered');
CREATE TYPE communication_channel AS ENUM ('sms', 'email', 'in_app');

-- ============================================
-- SMS/EMAIL CAMPAIGNS (bulk messages)
-- ============================================
CREATE TABLE public.message_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  channel communication_channel NOT NULL DEFAULT 'sms',
  subject TEXT,
  body TEXT NOT NULL,
  recipient_filter JSONB DEFAULT '{}', -- { type: 'all'|'department'|'group'|'custom', ids: [] }
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft | scheduled | sending | sent | failed
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_campaigns_church ON public.message_campaigns(church_id, created_at DESC);
CREATE INDEX idx_msg_campaigns_scheduled ON public.message_campaigns(scheduled_at)
  WHERE status = 'scheduled';

-- ============================================
-- INDIVIDUAL MESSAGES (per recipient)
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.message_campaigns(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.church_memberships(id) ON DELETE SET NULL,
  channel communication_channel NOT NULL DEFAULT 'sms',
  to_address TEXT NOT NULL, -- phone or email
  body TEXT NOT NULL,
  status sms_status DEFAULT 'queued',
  provider_id TEXT,
  provider_response JSONB,
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_campaign ON public.messages(campaign_id);
CREATE INDEX idx_messages_church ON public.messages(church_id, created_at DESC);
CREATE INDEX idx_messages_status ON public.messages(status) WHERE status IN ('queued', 'sending');

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  published BOOLEAN DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_church ON public.announcements(church_id, published_at DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.message_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg_campaigns_admin" ON public.message_campaigns
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

CREATE POLICY "messages_admin_read" ON public.messages
  FOR SELECT USING (public.is_church_admin(church_id));

CREATE POLICY "messages_member_read_own" ON public.messages
  FOR SELECT USING (
    membership_id IN (
      SELECT id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "announcements_read" ON public.announcements
  FOR SELECT USING (
    published = TRUE
    AND church_id IN (
      SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "announcements_admin_write" ON public.announcements
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));