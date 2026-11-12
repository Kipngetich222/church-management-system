-- Settings and payment credentials are accessed only by the API service role.
-- Secrets are encrypted by the application before they reach these tables.
CREATE TABLE public.church_giving_settings (
  church_id UUID PRIMARY KEY REFERENCES public.churches(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('paybill', 'till', 'pochi', 'phone')),
  destination_number TEXT NOT NULL,
  account_reference TEXT NOT NULL DEFAULT '' CHECK (length(account_reference) <= 12),
  business_shortcode TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  credentials_ciphertext TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT giving_destination_number CHECK (
    (destination_type IN ('paybill', 'till') AND destination_number ~ '^[0-9]{5,7}$') OR
    (destination_type IN ('pochi', 'phone') AND destination_number ~ '^254[17][0-9]{8}$')
  ),
  CONSTRAINT giving_enabled_connection CHECK (NOT enabled OR (
    destination_type IN ('paybill', 'till') AND business_shortcode ~ '^[0-9]{5,7}$'
    AND credentials_ciphertext IS NOT NULL
  ))
);
ALTER TABLE public.church_giving_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.church_giving_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.church_giving_settings TO service_role;

CREATE TABLE public.giving_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.church_memberships(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  request_id UUID NOT NULL,
  amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 250000),
  phone TEXT NOT NULL CHECK (phone ~ '^254[17][0-9]{8}$'),
  type public.offering_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiating' CHECK (status IN ('initiating', 'pending', 'succeeded', 'failed', 'review')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  destination_type TEXT NOT NULL CHECK (destination_type IN ('paybill', 'till')),
  destination_number TEXT NOT NULL CHECK (destination_number ~ '^[0-9]{5,7}$'),
  account_reference TEXT NOT NULL CHECK (length(account_reference) BETWEEN 1 AND 12),
  business_shortcode TEXT NOT NULL CHECK (business_shortcode ~ '^[0-9]{5,7}$'),
  credentials_ciphertext TEXT NOT NULL,
  callback_token_hash TEXT NOT NULL CHECK (callback_token_hash ~ '^[a-f0-9]{64}$'),
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  mpesa_receipt TEXT,
  result_code INTEGER,
  error TEXT,
  offering_id UUID UNIQUE,
  receipt_details JSONB NOT NULL,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(church_id, user_id, request_id),
  UNIQUE(environment, checkout_request_id),
  UNIQUE(environment, mpesa_receipt),
  CONSTRAINT giving_payment_completed CHECK (
    (status = 'succeeded') = (offering_id IS NOT NULL)
    AND (status <> 'succeeded' OR confirmed_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX giving_one_pending_per_member ON public.giving_payments(church_id, user_id)
  WHERE status IN ('initiating', 'pending', 'review') AND user_id IS NOT NULL;
CREATE INDEX giving_payments_history ON public.giving_payments(church_id, created_at DESC, id);
ALTER TABLE public.giving_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.giving_payments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.giving_payments TO service_role;

CREATE FUNCTION public.guard_giving_payment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.church_memberships m WHERE m.id = NEW.membership_id
      AND m.church_id = NEW.church_id AND m.user_id = NEW.user_id AND COALESCE(m.status, 'active') = 'active') THEN
      RAISE EXCEPTION 'The payment requires an active member of this church' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF (NEW.id, NEW.church_id, NEW.request_id, NEW.amount, NEW.phone, NEW.type, NEW.environment,
        NEW.destination_type, NEW.destination_number, NEW.account_reference, NEW.business_shortcode,
        NEW.credentials_ciphertext, NEW.callback_token_hash, NEW.receipt_details, NEW.created_at)
      IS DISTINCT FROM
       (OLD.id, OLD.church_id, OLD.request_id, OLD.amount, OLD.phone, OLD.type, OLD.environment,
        OLD.destination_type, OLD.destination_number, OLD.account_reference, OLD.business_shortcode,
        OLD.credentials_ciphertext, OLD.callback_token_hash, OLD.receipt_details, OLD.created_at)
      OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL)
      OR (NEW.membership_id IS DISTINCT FROM OLD.membership_id AND NEW.membership_id IS NOT NULL)
    THEN RAISE EXCEPTION 'A payment request cannot be changed after creation' USING ERRCODE = '23514'; END IF;
    IF (OLD.checkout_request_id IS NOT NULL AND NEW.checkout_request_id IS DISTINCT FROM OLD.checkout_request_id)
      OR (OLD.merchant_request_id IS NOT NULL AND NEW.merchant_request_id IS DISTINCT FROM OLD.merchant_request_id)
      OR (OLD.mpesa_receipt IS NOT NULL AND NEW.mpesa_receipt IS DISTINCT FROM OLD.mpesa_receipt)
      OR (OLD.status = 'succeeded' AND (NEW.status <> 'succeeded' OR NEW.offering_id IS DISTINCT FROM OLD.offering_id))
    THEN RAISE EXCEPTION 'Confirmed payment identity cannot be changed' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER giving_payment_immutable BEFORE INSERT OR UPDATE ON public.giving_payments
FOR EACH ROW EXECUTE FUNCTION public.guard_giving_payment();

ALTER TABLE public.offerings
  ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'test', 'pending', 'failed', 'review')),
  ADD COLUMN payment_id UUID UNIQUE REFERENCES public.giving_payments(id) DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN receipt_details JSONB;
ALTER TABLE public.giving_payments ADD CONSTRAINT giving_payment_offering_fk
  FOREIGN KEY(offering_id) REFERENCES public.offerings(id) DEFERRABLE INITIALLY DEFERRED;

-- The old implementation saved requests as income without a checkout ID.
-- Keep those records for review, but remove them from income and receipts.
UPDATE public.offerings SET status = CASE
  WHEN notes LIKE 'M-Pesa failed:%' THEN 'failed' ELSE 'review' END,
  receipt_number = NULL
WHERE method = 'mpesa' AND (
  notes = 'Awaiting M-Pesa confirmation' OR notes LIKE 'M-Pesa failed:%' OR reference LIKE 'MPESA-%'
);

CREATE FUNCTION public.has_giving_finance_permission(p_church UUID, p_permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.church_memberships m
    JOIN public.role_permissions r ON r.church_id = m.church_id AND r.role = m.role::TEXT
    WHERE m.user_id = auth.uid() AND m.church_id = p_church
      AND COALESCE(m.status, 'active') = 'active' AND m.role IN ('super_admin', 'dept_admin')
      AND p_permission IN ('finance:read', 'finance:write')
      AND (p_permission = ANY(r.permissions) OR 'finance:*' = ANY(r.permissions))
  )
$$;
REVOKE ALL ON FUNCTION public.has_giving_finance_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_giving_finance_permission(UUID, TEXT) TO authenticated, service_role;

DROP POLICY offerings_admin_all ON public.offerings;
DROP POLICY offerings_member_read_own ON public.offerings;
CREATE POLICY offerings_finance_read ON public.offerings FOR SELECT TO authenticated
USING (public.has_giving_finance_permission(church_id, 'finance:read'));
CREATE POLICY offerings_member_read_own ON public.offerings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.church_memberships m WHERE m.id = membership_id
    AND m.church_id = offerings.church_id AND m.user_id = auth.uid() AND COALESCE(m.status, 'active') = 'active')
);
CREATE POLICY offerings_manual_insert ON public.offerings FOR INSERT TO authenticated
WITH CHECK (public.has_giving_finance_permission(church_id, 'finance:write') AND payment_id IS NULL AND status = 'completed');
CREATE POLICY offerings_manual_update ON public.offerings FOR UPDATE TO authenticated
USING (public.has_giving_finance_permission(church_id, 'finance:write') AND payment_id IS NULL)
WITH CHECK (public.has_giving_finance_permission(church_id, 'finance:write') AND payment_id IS NULL AND status = 'completed');
CREATE POLICY offerings_manual_delete ON public.offerings FOR DELETE TO authenticated
USING (public.has_giving_finance_permission(church_id, 'finance:write') AND payment_id IS NULL);

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sequence_text TEXT;
BEGIN
  IF NEW.amount <= 0 AND (TG_OP = 'INSERT' OR NEW.amount IS DISTINCT FROM OLD.amount) THEN
    RAISE EXCEPTION 'The giving amount must be positive' USING ERRCODE = '23514';
  END IF;
  IF NEW.membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.church_memberships WHERE id = NEW.membership_id AND church_id = NEW.church_id
  ) THEN RAISE EXCEPTION 'The giving member must belong to this church' USING ERRCODE = '23514'; END IF;
  IF NEW.campaign_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campaigns WHERE id = NEW.campaign_id AND church_id = NEW.church_id
  ) THEN RAISE EXCEPTION 'The giving campaign must belong to this church' USING ERRCODE = '23514'; END IF;
  IF NEW.pledge_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pledges WHERE id = NEW.pledge_id AND church_id = NEW.church_id
      AND membership_id = NEW.membership_id
  ) THEN RAISE EXCEPTION 'The pledge must belong to this church and member' USING ERRCODE = '23514'; END IF;
  IF NEW.status NOT IN ('completed', 'test') THEN
    NEW.receipt_number := NULL;
  ELSIF NEW.receipt_number IS NULL THEN
    sequence_text := nextval('public.receipt_number_seq')::TEXT;
    NEW.receipt_number := CASE WHEN NEW.status = 'test' THEN 'TEST-' ELSE 'RCP-' END ||
      to_char(now() AT TIME ZONE 'Africa/Nairobi', 'YYYY') || '-' ||
      lpad(sequence_text, greatest(6, length(sequence_text)), '0');
  END IF;
  IF NEW.receipt_details IS NULL THEN
    SELECT jsonb_build_object(
      'church', jsonb_build_object('name', c.name, 'logo_url', c.logo_url,
        'address', c.address, 'phone', c.phone, 'email', c.email),
      'donor', jsonb_build_object('full_name', COALESCE(m.full_name, u.full_name, 'Anonymous'),
        'email', COALESCE(m.email, u.email))
    ) INTO NEW.receipt_details FROM public.churches c
    LEFT JOIN public.church_memberships m ON m.id = NEW.membership_id
    LEFT JOIN public.users u ON u.id = m.user_id
    WHERE c.id = NEW.church_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER trg_offerings_receipt ON public.offerings;
CREATE TRIGGER trg_offerings_receipt BEFORE INSERT OR UPDATE ON public.offerings
FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();
-- Includes anonymous and manually recorded giving, without truncating the sequence.
UPDATE public.offerings SET receipt_number = receipt_number;

-- One transaction both credits the ledger and finalizes the payment. Row locking
-- and unique links make duplicate callbacks and concurrent status checks harmless.
CREATE FUNCTION public.confirm_giving_payment(
  p_id UUID, p_checkout TEXT, p_receipt TEXT DEFAULT NULL, p_paid_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.giving_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE payment public.giving_payments; offering UUID;
BEGIN
  SELECT * INTO payment FROM public.giving_payments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR payment.checkout_request_id IS DISTINCT FROM p_checkout OR p_checkout IS NULL THEN
    RAISE EXCEPTION 'Payment checkout does not match' USING ERRCODE = '23514';
  END IF;
  IF p_receipt IS NOT NULL AND p_receipt !~ '^[A-Z0-9]{8,20}$' THEN
    RAISE EXCEPTION 'Invalid payment receipt' USING ERRCODE = '23514';
  END IF;
  IF payment.mpesa_receipt IS NOT NULL AND p_receipt IS NOT NULL AND payment.mpesa_receipt <> p_receipt THEN
    RAISE EXCEPTION 'Payment receipt does not match' USING ERRCODE = '23514';
  END IF;
  IF payment.offering_id IS NULL THEN
    INSERT INTO public.offerings(church_id, membership_id, amount, currency, type, method,
      status, payment_id, reference, given_at, receipt_details, notes)
    VALUES (payment.church_id, payment.membership_id, payment.amount, 'KES', payment.type, 'mpesa',
      CASE WHEN payment.environment = 'sandbox' THEN 'test' ELSE 'completed' END,
      payment.id, p_receipt, COALESCE(p_paid_at, now()), payment.receipt_details,
      CASE WHEN payment.environment = 'sandbox' THEN 'Sandbox payment: no money received' ELSE 'M-Pesa confirmed' END)
    RETURNING id INTO offering;
  ELSE
    offering := payment.offering_id;
    IF p_receipt IS NOT NULL THEN
      UPDATE public.offerings SET reference = p_receipt WHERE id = offering;
    END IF;
  END IF;
  UPDATE public.giving_payments SET status = 'succeeded', offering_id = offering,
    mpesa_receipt = COALESCE(mpesa_receipt, p_receipt), result_code = 0, error = NULL,
    confirmed_at = COALESCE(confirmed_at, p_paid_at, now())
  WHERE id = payment.id RETURNING * INTO payment;
  RETURN payment;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_giving_payment(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_giving_payment(UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- A server-only union gives both clients complete, consistently paginated history.
CREATE VIEW public.giving_history AS
SELECT COALESCE(o.payment_id, o.id) AS id, o.church_id, o.membership_id, o.payment_id, o.id AS offering_id,
  o.amount, COALESCE(o.currency, 'KES') AS currency, o.type, o.method::TEXT, o.status,
  o.reference, o.receipt_number, COALESCE(o.given_at, o.created_at) AS given_at,
  COALESCE(o.receipt_details #>> '{donor,full_name}', 'Anonymous') AS donor_name,
  o.receipt_details #>> '{donor,email}' AS donor_email,
  o.receipt_details ->> 'phone' AS phone,
  o.receipt_details ->> 'destination_type' AS destination_type,
  o.receipt_details ->> 'destination_number' AS destination_number,
  CASE WHEN o.status IN ('review', 'failed') THEN o.notes ELSE NULL END AS error,
  COALESCE(p.created_at, o.created_at, o.given_at, 'epoch'::TIMESTAMPTZ) AS created_at
FROM public.offerings o LEFT JOIN public.giving_payments p ON p.id = o.payment_id
UNION ALL
SELECT p.id, p.church_id, p.membership_id, p.id AS payment_id, NULL::UUID AS offering_id,
  p.amount, 'KES', p.type, 'mpesa',
  CASE WHEN p.status = 'initiating' THEN 'pending' ELSE p.status END,
  p.mpesa_receipt, NULL::TEXT, p.created_at,
  COALESCE(p.receipt_details #>> '{donor,full_name}', 'Anonymous'),
  p.receipt_details #>> '{donor,email}', p.phone, p.destination_type, p.destination_number, p.error, p.created_at
FROM public.giving_payments p WHERE p.offering_id IS NULL;
REVOKE ALL ON public.giving_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.giving_history TO service_role;
