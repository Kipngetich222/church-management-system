-- One platform provider account; isolated prepaid credit balances per church.
-- Sandbox credit can never pay for production messages. All financial writes
-- and dispatch transitions are service-only, transactional and idempotent.
CREATE FUNCTION public.is_communication_admin(p_church UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM church_memberships WHERE church_id = p_church
    AND user_id = auth.uid() AND role IN ('super_admin', 'dept_admin') AND status = 'active');
$$;

ALTER TABLE public.message_campaigns
  ADD COLUMN request_id TEXT,
  ADD COLUMN sms_environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (sms_environment IN ('sandbox', 'production')),
  ADD COLUMN sms_units INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN created_by_name TEXT NOT NULL DEFAULT 'Former administrator',
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN error TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
UPDATE public.message_campaigns c SET created_by_name = coalesce(u.full_name, u.email, 'Administrator') FROM public.users u WHERE u.id = c.created_by;
CREATE UNIQUE INDEX message_campaign_request ON public.message_campaigns(church_id, request_id) WHERE request_id IS NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN recipient_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN sms_parts INTEGER NOT NULL DEFAULT 0 CHECK (sms_parts >= 0),
  ADD COLUMN credit_state TEXT NOT NULL DEFAULT 'none' CHECK (credit_state IN ('none', 'reserved', 'charged', 'released'));
CREATE INDEX messages_provider_reference ON public.messages(provider_id) WHERE provider_id IS NOT NULL;

CREATE TABLE public.sms_wallets (
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  purchased BIGINT NOT NULL DEFAULT 0 CHECK (purchased >= 0),
  available BIGINT NOT NULL DEFAULT 0 CHECK (available >= 0),
  used BIGINT NOT NULL DEFAULT 0 CHECK (used >= 0),
  reserved BIGINT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (church_id, environment),
  CHECK (purchased = available + used + reserved)
);
CREATE TABLE public.sms_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  request_id UUID NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0 AND credits <= 100000),
  amount_kes INTEGER NOT NULL CHECK (amount_kes > 0),
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiating' CHECK (status IN ('initiating', 'pending', 'paid', 'failed', 'review')),
  checkout_id TEXT UNIQUE,
  merchant_id TEXT,
  receipt TEXT UNIQUE,
  error TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  UNIQUE(church_id, request_id)
);
CREATE UNIQUE INDEX sms_one_pending_purchase ON public.sms_purchases(church_id, environment) WHERE status IN ('initiating', 'pending', 'review');

CREATE TABLE public.sms_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('purchase', 'reserve', 'usage', 'release')),
  units INTEGER NOT NULL CHECK (units > 0),
  balance_after BIGINT NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  campaign_id UUID REFERENCES public.message_campaigns(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES public.sms_purchases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sms_ledger_church ON public.sms_credit_ledger(church_id, environment, created_at DESC);
CREATE UNIQUE INDEX sms_purchase_once ON public.sms_credit_ledger(purchase_id) WHERE kind = 'purchase';
CREATE UNIQUE INDEX sms_message_charge_once ON public.sms_credit_ledger(message_id) WHERE kind IN ('usage', 'release');

ALTER TABLE public.sms_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_wallets, public.sms_purchases, public.sms_credit_ledger FROM anon, authenticated;
GRANT SELECT ON public.sms_wallets, public.sms_purchases, public.sms_credit_ledger TO authenticated;
GRANT ALL ON public.sms_wallets, public.sms_purchases, public.sms_credit_ledger TO service_role;
CREATE POLICY sms_wallet_read ON public.sms_wallets FOR SELECT TO authenticated USING (public.is_communication_admin(church_id));
CREATE POLICY sms_purchase_read ON public.sms_purchases FOR SELECT TO authenticated USING (public.is_communication_admin(church_id));
CREATE POLICY sms_ledger_read ON public.sms_credit_ledger FOR SELECT TO authenticated USING (public.is_communication_admin(church_id));
DROP POLICY msg_campaigns_admin ON public.message_campaigns;
CREATE POLICY msg_campaigns_admin_read ON public.message_campaigns FOR SELECT TO authenticated USING (public.is_communication_admin(church_id));
REVOKE INSERT, UPDATE, DELETE ON public.message_campaigns, public.messages FROM anon, authenticated;
DROP POLICY messages_admin_read ON public.messages;
CREATE POLICY messages_admin_read ON public.messages FOR SELECT TO authenticated USING (public.is_communication_admin(church_id));

-- Every filter is tenant scoped; a department administrator's selection is
-- intersected with their current leadership scope, including scheduled sends.
CREATE FUNCTION public.communication_recipients(p_church UUID, p_actor UUID, p_filter JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor church_memberships; kind TEXT := p_filter->>'type'; ids TEXT[]; result JSONB;
BEGIN
  IF kind IS NULL OR kind NOT IN ('all', 'department', 'group', 'custom', 'category', 'leaders') THEN RAISE EXCEPTION 'Invalid recipient filter'; END IF;
  IF jsonb_typeof(p_filter->'ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid recipient selection'; END IF;
  SELECT coalesce(array_agg(value), ARRAY[]::TEXT[]) INTO ids FROM jsonb_array_elements_text(p_filter->'ids');
  IF kind IN ('department', 'group', 'custom', 'category') AND cardinality(ids) = 0 THEN RETURN '[]'::JSONB; END IF;
  IF kind = 'category' AND NOT ids <@ ARRAY['men','women','youth','children'] THEN RAISE EXCEPTION 'Invalid member category'; END IF;
  IF p_actor IS NOT NULL THEN
    SELECT * INTO actor FROM church_memberships WHERE church_id = p_church AND user_id = p_actor AND status = 'active' AND role IN ('super_admin', 'dept_admin');
    IF actor.id IS NULL THEN RAISE EXCEPTION 'Active church administrator required'; END IF;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id', m.id, 'user_id', m.user_id,
      'name', coalesce(nullif(m.full_name,''),u.full_name,'Member'), 'phone', coalesce(nullif(m.phone,''),u.phone), 'email', coalesce(nullif(m.email,''),u.email)) ORDER BY m.id), '[]'::JSONB)
    INTO result FROM church_memberships m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.church_id = p_church AND m.status = 'active'
    AND (p_actor IS NULL OR actor.role = 'super_admin' OR EXISTS (
      SELECT 1 FROM department_members target JOIN departments d ON d.id = target.department_id
      JOIN department_members lead ON lead.department_id = target.department_id
      WHERE d.church_id = p_church AND target.membership_id = m.id AND lead.membership_id = actor.id AND lead.is_leader))
    AND (kind = 'all'
      OR (kind = 'custom' AND m.id::TEXT = ANY(ids))
      OR (kind = 'category' AND coalesce(m.category::TEXT, u.category::TEXT,
        CASE WHEN coalesce(m.date_of_birth,u.date_of_birth) > current_date - interval '13 years' THEN 'children'
          WHEN coalesce(m.date_of_birth,u.date_of_birth) > current_date - interval '30 years' THEN 'youth'
          WHEN coalesce(m.gender,u.gender) = 'male' THEN 'men' WHEN coalesce(m.gender,u.gender) = 'female' THEN 'women' END) = ANY(ids))
      OR (kind = 'department' AND EXISTS (SELECT 1 FROM department_members dm JOIN departments d ON d.id = dm.department_id WHERE dm.membership_id = m.id AND d.church_id = p_church AND d.id::TEXT = ANY(ids)))
      OR (kind = 'group' AND EXISTS (SELECT 1 FROM small_group_members gm JOIN small_groups g ON g.id = gm.group_id WHERE gm.membership_id = m.id AND g.church_id = p_church AND g.id::TEXT = ANY(ids)))
      OR (kind = 'leaders' AND (m.role IN ('super_admin','dept_admin')
        OR EXISTS (SELECT 1 FROM department_members dm JOIN departments d ON d.id = dm.department_id WHERE dm.membership_id = m.id AND dm.is_leader AND d.church_id = p_church)
        OR EXISTS (SELECT 1 FROM small_groups g WHERE g.leader_membership_id = m.id AND g.church_id = p_church)
        OR EXISTS (SELECT 1 FROM church_leaders l WHERE l.church_id = p_church AND ((nullif(l.email,'') IS NOT NULL AND lower(l.email) = lower(coalesce(m.email,u.email))) OR (nullif(l.phone,'') IS NOT NULL AND regexp_replace(l.phone,'[^0-9]','','g') = regexp_replace(coalesce(m.phone,u.phone),'[^0-9]','','g')))))));
  RETURN result;
END;
$$;

CREATE FUNCTION public.claim_message_campaign(p_id UUID, p_environment TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c message_campaigns;
BEGIN
  UPDATE message_campaigns SET status = 'sending', updated_at = now()
    WHERE id = p_id AND sms_environment = p_environment AND status IN ('queued','scheduled') AND (scheduled_at IS NULL OR scheduled_at <= now()) RETURNING * INTO c;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  RETURN to_jsonb(c);
END;
$$;

CREATE FUNCTION public.prepare_message_campaign(p_id UUID, p_rows JSONB, p_parts INTEGER) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c message_campaigns; needed INTEGER; balance BIGINT;
BEGIN
  SELECT * INTO c FROM message_campaigns WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'sending' OR EXISTS (SELECT 1 FROM messages WHERE campaign_id = p_id) THEN RAISE EXCEPTION 'Campaign already prepared or not claimed'; END IF;
  IF p_parts < 0 OR p_parts > 24 THEN RAISE EXCEPTION 'Invalid SMS parts'; END IF;
  SELECT count(*) * p_parts INTO needed FROM jsonb_array_elements(p_rows) r WHERE r->>'status' = 'sending' AND c.channel = 'sms';
  IF needed > 0 THEN
    UPDATE sms_wallets SET available = available - needed, reserved = reserved + needed, updated_at = now()
      WHERE church_id = c.church_id AND environment = c.sms_environment AND available >= needed RETURNING available INTO balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient SMS credits. Ask a super admin to purchase more.'; END IF;
    INSERT INTO sms_credit_ledger(church_id,environment,kind,units,balance_after,actor_id,actor_name,campaign_id)
      VALUES(c.church_id,c.sms_environment,'reserve',needed,balance,c.created_by,c.created_by_name,c.id);
  END IF;
  INSERT INTO messages(campaign_id,church_id,membership_id,channel,to_address,recipient_name,body,status,error,sms_parts,credit_state)
    SELECT c.id,c.church_id,(r->>'membership_id')::UUID,c.channel,r->>'to_address',r->>'recipient_name',c.body,(r->>'status')::sms_status,r->>'error',
      CASE WHEN c.channel = 'sms' AND r->>'status' = 'sending' THEN p_parts ELSE 0 END,
      CASE WHEN c.channel = 'sms' AND r->>'status' = 'sending' THEN 'reserved' ELSE 'none' END FROM jsonb_array_elements(p_rows) r;
  UPDATE message_campaigns SET total_recipients = jsonb_array_length(p_rows), updated_at = now() WHERE id = c.id;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]'::JSONB) FROM messages m WHERE campaign_id = c.id);
END;
$$;

CREATE FUNCTION public.settle_message_batch(p_id UUID, p_results JSONB) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c message_campaigns; m messages; r JSONB; balance BIGINT; accepted INTEGER; rejected INTEGER; waiting INTEGER;
BEGIN
  SELECT * INTO c FROM message_campaigns WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Campaign not found'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_results) LOOP
    SELECT * INTO m FROM messages WHERE id = (r->>'id')::UUID AND campaign_id = p_id FOR UPDATE;
    IF m.id IS NULL OR m.status <> 'sending' THEN CONTINUE; END IF;
    IF r->>'status' NOT IN ('sent','failed','sending') THEN RAISE EXCEPTION 'Invalid delivery status'; END IF;
    IF m.credit_state = 'reserved' AND r->>'status' IN ('sent','failed') THEN
      UPDATE sms_wallets SET reserved = reserved - m.sms_parts,
        used = used + CASE WHEN r->>'status' = 'sent' THEN m.sms_parts ELSE 0 END,
        available = available + CASE WHEN r->>'status' = 'failed' THEN m.sms_parts ELSE 0 END, updated_at = now()
        WHERE church_id = c.church_id AND environment = c.sms_environment RETURNING available INTO balance;
      INSERT INTO sms_credit_ledger(church_id,environment,kind,units,balance_after,actor_id,actor_name,campaign_id,message_id)
        VALUES(c.church_id,c.sms_environment,CASE WHEN r->>'status' = 'sent' THEN 'usage' ELSE 'release' END,m.sms_parts,balance,c.created_by,c.created_by_name,c.id,m.id);
    END IF;
    UPDATE messages SET status = (r->>'status')::sms_status, provider_id = r->>'provider_id', provider_response = r->'provider_response', error = r->>'error',
      sent_at = CASE WHEN r->>'status' = 'sent' THEN now() ELSE NULL END,
      credit_state = CASE WHEN credit_state <> 'reserved' THEN credit_state WHEN r->>'status' = 'sent' THEN 'charged' WHEN r->>'status' = 'failed' THEN 'released' ELSE 'reserved' END WHERE id = m.id;
  END LOOP;
  SELECT count(*) FILTER (WHERE status IN ('sent','delivered')),count(*) FILTER (WHERE status = 'failed'),count(*) FILTER (WHERE status IN ('queued','sending')) INTO accepted,rejected,waiting FROM messages WHERE campaign_id = p_id;
  UPDATE message_campaigns SET sent_count = accepted, failed_count = rejected,
    sms_units = (SELECT coalesce(sum(sms_parts),0) FROM messages WHERE campaign_id = p_id AND credit_state = 'charged'),
    status = CASE WHEN waiting > 0 AND EXISTS (SELECT 1 FROM messages WHERE campaign_id = p_id AND status = 'sending' AND error IS NOT NULL) THEN 'review' WHEN waiting > 0 THEN 'sending' WHEN accepted > 0 AND rejected > 0 THEN 'partial' WHEN accepted > 0 THEN 'sent' ELSE 'failed' END,
    error = CASE WHEN waiting > 0 AND EXISTS (SELECT 1 FROM messages WHERE campaign_id = p_id AND status = 'sending' AND error IS NOT NULL) THEN 'Some delivery outcomes are unconfirmed. Credits remain held; do not resend until reviewed.' ELSE NULL END,
    sent_at = CASE WHEN waiting = 0 THEN now() ELSE NULL END, updated_at = now() WHERE id = p_id;
END;
$$;

CREATE FUNCTION public.confirm_sms_purchase(p_id UUID, p_checkout TEXT, p_receipt TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p sms_purchases; balance BIGINT;
BEGIN
  SELECT * INTO p FROM sms_purchases WHERE id = p_id FOR UPDATE;
  IF p.id IS NULL OR p.checkout_id IS DISTINCT FROM p_checkout THEN RAISE EXCEPTION 'Payment does not match purchase'; END IF;
  IF p.status = 'paid' THEN
    IF p.receipt IS NULL AND nullif(p_receipt,'') IS NOT NULL THEN
      UPDATE sms_purchases SET receipt = p_receipt WHERE id = p.id RETURNING * INTO p;
    END IF;
    RETURN to_jsonb(p);
  END IF;
  IF p.status NOT IN ('pending','review') THEN RAISE EXCEPTION 'Purchase cannot be confirmed'; END IF;
  INSERT INTO sms_wallets(church_id,environment,purchased,available) VALUES(p.church_id,p.environment,p.credits,p.credits)
    ON CONFLICT(church_id,environment) DO UPDATE SET purchased = sms_wallets.purchased + p.credits, available = sms_wallets.available + p.credits, updated_at = now() RETURNING available INTO balance;
  UPDATE sms_purchases SET status = 'paid', receipt = nullif(p_receipt,''), error = NULL, paid_at = now() WHERE id = p_id RETURNING * INTO p;
  INSERT INTO sms_credit_ledger(church_id,environment,kind,units,balance_after,actor_id,actor_name,purchase_id)
    VALUES(p.church_id,p.environment,'purchase',p.credits,balance,p.created_by,p.created_by_name,p.id);
  INSERT INTO audit_logs(church_id,actor_id,action,entity_type,entity_id,metadata)
    VALUES(p.church_id,p.created_by,'sms.purchase_confirmed','sms_purchase',p.id,jsonb_build_object('credits',p.credits,'amount_kes',p.amount_kes,'checkout_id',p.checkout_id,'environment',p.environment));
  RETURN to_jsonb(p);
END;
$$;

CREATE FUNCTION public.edit_scheduled_message(p_id UUID, p_actor UUID, p_expected TIMESTAMPTZ, p_body TEXT, p_channel communication_channel, p_subject TEXT, p_filter JSONB, p_scheduled TIMESTAMPTZ, p_cancel BOOLEAN DEFAULT FALSE) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c message_campaigns; actor church_memberships; previous JSONB;
BEGIN
  SELECT * INTO c FROM message_campaigns WHERE id = p_id FOR UPDATE;
  SELECT * INTO actor FROM church_memberships WHERE church_id = c.church_id AND user_id = p_actor AND status = 'active' AND role IN ('super_admin','dept_admin');
  IF actor.id IS NULL OR (actor.role <> 'super_admin' AND c.created_by IS DISTINCT FROM p_actor) THEN RAISE EXCEPTION 'You cannot edit this campaign'; END IF;
  IF c.status <> 'scheduled' OR c.scheduled_at <= now() OR c.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This schedule changed or is already being sent. Refresh and try again.'; END IF;
  IF NOT p_cancel AND (p_scheduled IS NULL OR p_scheduled <= now() OR length(btrim(p_body)) = 0 OR length(p_body) > 1600) THEN RAISE EXCEPTION 'Choose a future time and a valid message'; END IF;
  IF NOT p_cancel THEN PERFORM public.communication_recipients(c.church_id,p_actor,p_filter); END IF;
  previous := to_jsonb(c);
  UPDATE message_campaigns SET body = CASE WHEN p_cancel THEN body ELSE p_body END,
    channel = CASE WHEN p_cancel THEN channel ELSE p_channel END, subject = CASE WHEN p_cancel THEN subject ELSE p_subject END,
    recipient_filter = CASE WHEN p_cancel THEN recipient_filter ELSE p_filter END, scheduled_at = CASE WHEN p_cancel THEN scheduled_at ELSE p_scheduled END,
    status = CASE WHEN p_cancel THEN 'cancelled' ELSE 'scheduled' END, updated_at = now(), updated_by = p_actor WHERE id = p_id RETURNING * INTO c;
  INSERT INTO audit_logs(church_id,actor_id,action,entity_type,entity_id,metadata)
    VALUES(c.church_id,p_actor,CASE WHEN p_cancel THEN 'communication.cancelled' ELSE 'communication.schedule_edited' END,'message_campaign',c.id,jsonb_build_object('before',previous,'after',to_jsonb(c)));
  RETURN to_jsonb(c);
END;
$$;

CREATE FUNCTION public.sms_usage_summary(p_church UUID, p_environment TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result JSONB; breakdown JSONB;
BEGIN
  IF NOT public.is_communication_admin(p_church) THEN RAISE EXCEPTION 'Active church administrator required'; END IF;
  SELECT jsonb_build_object('purchased',purchased,'available',available,'used',used,'reserved',reserved) INTO result FROM sms_wallets WHERE church_id = p_church AND environment = p_environment;
  SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::JSONB) INTO breakdown FROM (
    SELECT actor_name AS actor, sum(units) AS units, count(*) AS messages FROM sms_credit_ledger
      WHERE church_id = p_church AND environment = p_environment AND kind = 'usage' GROUP BY actor_id,actor_name ORDER BY sum(units) DESC
  ) s;
  RETURN coalesce(result,'{"purchased":0,"available":0,"used":0,"reserved":0}'::JSONB) || jsonb_build_object('breakdown',breakdown);
END;
$$;

REVOKE ALL ON FUNCTION public.communication_recipients(UUID,UUID,JSONB), public.claim_message_campaign(UUID,TEXT), public.prepare_message_campaign(UUID,JSONB,INTEGER), public.settle_message_batch(UUID,JSONB), public.confirm_sms_purchase(UUID,TEXT,TEXT), public.edit_scheduled_message(UUID,UUID,TIMESTAMPTZ,TEXT,communication_channel,TEXT,JSONB,TIMESTAMPTZ,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.communication_recipients(UUID,UUID,JSONB), public.claim_message_campaign(UUID,TEXT), public.prepare_message_campaign(UUID,JSONB,INTEGER), public.settle_message_batch(UUID,JSONB), public.confirm_sms_purchase(UUID,TEXT,TEXT), public.edit_scheduled_message(UUID,UUID,TIMESTAMPTZ,TEXT,communication_channel,TEXT,JSONB,TIMESTAMPTZ,BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION public.sms_usage_summary(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sms_usage_summary(UUID,TEXT) TO authenticated;

CREATE FUNCTION public.audit_communication_campaign() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs(church_id,actor_id,action,entity_type,entity_id,metadata)
      VALUES(NEW.church_id,coalesce(NEW.updated_by,NEW.created_by),
        CASE WHEN TG_OP = 'INSERT' THEN 'communication.created' ELSE 'communication.' || NEW.status END,
        'message_campaign',NEW.id,jsonb_build_object('channel',NEW.channel,'audience',NEW.recipient_filter,'scheduled_at',NEW.scheduled_at,'sender',NEW.created_by_name,'source',NEW.source,'sent',NEW.sent_count,'failed',NEW.failed_count,'credits_used',NEW.sms_units));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER audit_message_campaign AFTER INSERT OR UPDATE ON public.message_campaigns FOR EACH ROW EXECUTE FUNCTION public.audit_communication_campaign();
REVOKE ALL ON FUNCTION public.audit_communication_campaign() FROM PUBLIC,anon,authenticated,service_role;

-- Provider delivery callbacks can update delivery status but never refund
-- credits already consumed by an accepted submission.
CREATE FUNCTION public.record_sms_delivery(p_provider_id TEXT,p_status TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_status = 'Success' THEN
    UPDATE messages SET status = 'delivered',delivered_at = now() WHERE provider_id = p_provider_id AND channel = 'sms' AND status = 'sent';
  ELSIF p_status IN ('Failed','Rejected','Expired') THEN
    UPDATE messages SET error = 'Delivery report: ' || p_status WHERE provider_id = p_provider_id AND channel = 'sms' AND status = 'sent';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_sms_delivery(TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_delivery(TEXT,TEXT) TO service_role;

DROP POLICY announcements_admin_write ON public.announcements;
CREATE POLICY announcements_admin_write ON public.announcements FOR ALL TO authenticated
  USING (public.is_communication_admin(church_id)) WITH CHECK (public.is_communication_admin(church_id));
