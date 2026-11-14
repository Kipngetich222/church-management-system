-- Cash records, bills, supporting documents and an append-only finance history.
-- Existing gifts/expenses stay in place; corrections void a record, never delete it.
ALTER TABLE public.expense_categories ADD COLUMN created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.offerings
  DROP CONSTRAINT offerings_status_check,
  ADD CONSTRAINT offerings_status_check CHECK (status IN ('completed','test','pending','failed','review','voided')),
  ADD COLUMN request_id UUID,
  ADD COLUMN donor_name TEXT,
  ADD COLUMN recorded_by_name TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN change_reason TEXT,
  ADD COLUMN voided_at TIMESTAMPTZ,
  ADD COLUMN reconciled_at TIMESTAMPTZ,
  ADD COLUMN reconciliation_reference TEXT;
CREATE UNIQUE INDEX finance_giving_request ON public.offerings(church_id, request_id) WHERE request_id IS NOT NULL;
UPDATE public.offerings o SET recorded_by_name = COALESCE(nullif(btrim(u.full_name),''),nullif(btrim(u.email),'')) FROM public.users u WHERE u.id = o.recorded_by;

CREATE SEQUENCE public.finance_voucher_seq;

ALTER TABLE public.expenses
  ADD COLUMN request_id UUID,
  ADD COLUMN payee TEXT,
  ADD COLUMN invoice_number TEXT,
  ADD COLUMN invoice_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Nairobi')::DATE,
  ADD COLUMN due_date DATE,
  ADD COLUMN period_start DATE,
  ADD COLUMN period_end DATE,
  ADD COLUMN notes TEXT,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','unpaid','voided')),
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','sms_purchase','event_refund')),
  ADD COLUMN source_id UUID,
  ADD COLUMN category_name TEXT,
  ADD COLUMN voucher_number TEXT NOT NULL DEFAULT ('EXP-' || nextval('public.finance_voucher_seq')::TEXT) UNIQUE,
  ADD COLUMN recorded_by_name TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN change_reason TEXT,
  ADD COLUMN voided_at TIMESTAMPTZ,
  ADD COLUMN reconciled_at TIMESTAMPTZ,
  ADD COLUMN reconciliation_reference TEXT,
  ADD CONSTRAINT expense_service_period CHECK (period_end IS NULL OR (period_start IS NOT NULL AND period_end >= period_start)),
  ADD CONSTRAINT expense_source_identity CHECK ((source = 'manual') = (source_id IS NULL));
UPDATE public.expenses e SET invoice_date = COALESCE(e.spent_at, e.created_at, now()) AT TIME ZONE 'Africa/Nairobi',
  category_name = c.name FROM public.expense_categories c WHERE c.id = e.category_id;
UPDATE public.expenses SET invoice_date = COALESCE(spent_at, created_at, now()) AT TIME ZONE 'Africa/Nairobi' WHERE category_id IS NULL;
UPDATE public.expenses e SET recorded_by_name = COALESCE(nullif(btrim(u.full_name),''),nullif(btrim(u.email),'')) FROM public.users u WHERE u.id = e.recorded_by;
CREATE UNIQUE INDEX finance_expense_request ON public.expenses(church_id, request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX finance_expense_source ON public.expenses(church_id, source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX finance_unpaid_bills ON public.expenses(church_id, currency, due_date) WHERE status = 'unpaid';

CREATE TABLE public.finance_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  request_id UUID,
  category TEXT NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
  payee TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KES' CHECK (currency ~ '^[A-Z]{3}$'),
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  voucher_number TEXT NOT NULL DEFAULT ('INC-' || nextval('public.finance_voucher_seq')::TEXT) UNIQUE,
  notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','voided')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','event_registration')),
  source_id UUID,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  voided_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  reconciliation_reference TEXT,
  CHECK ((source = 'manual') = (source_id IS NULL)),
  UNIQUE(church_id, request_id),
  UNIQUE(church_id, source, source_id)
);
CREATE INDEX finance_income_date ON public.finance_income(church_id, received_at DESC, id);

-- Keep pledge identity even after a member leaves or deletes their account.
ALTER TABLE public.pledges
  DROP CONSTRAINT pledges_membership_id_fkey,
  ALTER COLUMN membership_id DROP NOT NULL,
  ADD CONSTRAINT pledges_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.church_memberships(id) ON DELETE SET NULL,
  ADD COLUMN member_name TEXT,
  ADD COLUMN request_id UUID,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN change_reason TEXT;
UPDATE public.pledges p SET member_name = COALESCE(nullif(btrim(m.full_name),''), nullif(btrim(u.full_name),''), nullif(btrim(m.email),''), nullif(btrim(u.email),''), 'Former member')
FROM public.church_memberships m LEFT JOIN public.users u ON u.id = m.user_id WHERE m.id = p.membership_id;
CREATE UNIQUE INDEX finance_pledge_request ON public.pledges(church_id, request_id) WHERE request_id IS NOT NULL;
ALTER TABLE public.campaigns
  ADD COLUMN request_id UUID,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN change_reason TEXT;
CREATE UNIQUE INDEX finance_campaign_request ON public.campaigns(church_id, request_id) WHERE request_id IS NOT NULL;

CREATE TABLE public.finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KES' CHECK (currency ~ '^[A-Z]{3}$'),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  UNIQUE(church_id, request_id)
);

CREATE TABLE public.finance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  reason TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX finance_audit_entity ON public.finance_audit(church_id, entity_type, entity_id, created_at DESC, id);
CREATE INDEX finance_audit_date ON public.finance_audit(church_id, created_at DESC, id);

CREATE TABLE public.finance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('giving','expense','income')),
  entity_id UUID NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (split_part(file_path, '/', 1) = church_id::TEXT)
);
CREATE INDEX finance_documents_entity ON public.finance_documents(church_id, entity_type, entity_id);
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('finance-documents','finance-documents',FALSE,10485760,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET public = FALSE, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
-- Only server code can issue short-lived download URLs after finance authorization.

-- Apply finance permissions consistently to every financial table.
DROP POLICY expenses_admin_all ON public.expenses;
DROP POLICY expense_categories_read ON public.expense_categories;
DROP POLICY expense_categories_admin_write ON public.expense_categories;
DROP POLICY campaigns_admin_write ON public.campaigns;
DROP POLICY pledges_admin_all ON public.pledges;
DROP POLICY pledges_member_read_own ON public.pledges;
DROP POLICY offerings_manual_insert ON public.offerings;
DROP POLICY offerings_manual_update ON public.offerings;
DROP POLICY offerings_manual_delete ON public.offerings;
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['expenses','expense_categories','finance_income','finance_budgets','finance_audit','finance_documents','pledges','campaigns'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', tbl);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
    EXECUTE format('CREATE POLICY finance_read ON public.%I FOR SELECT TO authenticated USING (public.has_giving_finance_permission(church_id, ''finance:read''))', tbl);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.offerings FROM anon, authenticated;
CREATE POLICY pledges_member_read_own ON public.pledges FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.church_memberships m WHERE m.id = membership_id AND m.church_id = pledges.church_id
    AND m.user_id = auth.uid() AND COALESCE(m.status,'active') = 'active')
);

CREATE FUNCTION public.finance_preserve_record() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- An explicitly deleted church still follows the existing church deletion policy.
  IF EXISTS (SELECT 1 FROM public.churches WHERE id = OLD.church_id) THEN
    RAISE EXCEPTION 'Finance records cannot be deleted. Void or cancel the record with a reason.' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END $$;
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['offerings','expenses','finance_income','finance_budgets','pledges','campaigns','expense_categories','finance_documents','finance_audit'] LOOP
    EXECUTE format('CREATE TRIGGER finance_no_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_preserve_record()',tbl);
  END LOOP;
END $$;

CREATE FUNCTION public.finance_guard_record() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n JSONB := to_jsonb(NEW); o JSONB; src TEXT; actor UUID; nm TEXT; expected_currency TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    -- Link a uniquely matched manual SMS expense without replacing its voucher,
    -- filing or payment details. Only the verified purchase capture may do this.
    IF TG_TABLE_NAME = 'expenses' AND pg_trigger_depth() > 1
      AND o->>'source' = 'manual' AND n->>'source' = 'sms_purchase'
      AND (n - ARRAY['source','source_id','change_reason','updated_at','updated_by']) =
          (o - ARRAY['source','source_id','change_reason','updated_at','updated_by']) THEN
      IF EXISTS (SELECT 1 FROM public.sms_purchases p WHERE p.id = NEW.source_id AND p.church_id = NEW.church_id
        AND p.status = 'paid' AND p.environment = 'production' AND p.amount_kes = NEW.amount
        AND COALESCE(NEW.currency,'KES') = 'KES' AND NEW.method = 'mpesa' AND NEW.status = 'paid'
        AND nullif(btrim(p.receipt),'') IS NOT NULL AND upper(btrim(p.receipt)) = upper(btrim(NEW.reference))) THEN
        NEW.updated_at := clock_timestamp(); NEW.updated_by := NULL;
        NEW.change_reason := 'Matched this existing expense to a confirmed SMS purchase using its M-Pesa receipt, amount and currency.';
        RETURN NEW;
      END IF;
    END IF;
    -- Foreign-key nulling must work when people leave; the saved names remain.
    IF (n - ARRAY['membership_id','recorded_by','updated_by','created_by']) = (o - ARRAY['membership_id','recorded_by','updated_by','created_by'])
       AND NOT EXISTS (SELECT 1 FROM jsonb_each(n) e WHERE e.key IN ('membership_id','recorded_by','updated_by','created_by')
         AND e.value IS DISTINCT FROM o->e.key AND e.value <> 'null'::JSONB) THEN RETURN NEW; END IF;
    IF (n->>'id',n->>'church_id',n->>'created_at',n->>'request_id') IS DISTINCT FROM
       (o->>'id',o->>'church_id',o->>'created_at',o->>'request_id') THEN
      RAISE EXCEPTION 'The identity of a finance record cannot change' USING ERRCODE = '23514';
    END IF;
    IF o->>'status' IN ('voided','cancelled') THEN
      RAISE EXCEPTION 'A voided or cancelled record cannot be changed' USING ERRCODE = '23514';
    END IF;
    src := CASE WHEN TG_TABLE_NAME = 'offerings' THEN CASE WHEN n->>'payment_id' IS NULL THEN 'manual' ELSE 'giving_payment' END ELSE COALESCE(n->>'source','manual') END;
    IF TG_TABLE_NAME IN ('offerings','expenses','finance_income') THEN
      IF src <> 'manual' AND (n - ARRAY['reference','reconciled_at','reconciliation_reference','updated_by','updated_at','change_reason'])
         IS DISTINCT FROM (o - ARRAY['reference','reconciled_at','reconciliation_reference','updated_by','updated_at','change_reason']) THEN
        RAISE EXCEPTION 'System payment amounts and identities cannot be edited or voided' USING ERRCODE = '23514';
      END IF;
      IF (n->>'amount',n->>'currency',n->>'membership_id',n->>'type',n->>'category_id',n->>'campaign_id',n->>'pledge_id',n->>'source',n->>'source_id',n->>'payment_id')
        IS DISTINCT FROM (o->>'amount',o->>'currency',o->>'membership_id',o->>'type',o->>'category_id',o->>'campaign_id',o->>'pledge_id',o->>'source',o->>'source_id',o->>'payment_id') THEN
        RAISE EXCEPTION 'Void and replace a record to correct its amount, currency or allocation' USING ERRCODE = '23514';
      END IF;
      IF TG_TABLE_NAME = 'expenses' AND o->>'status' = 'paid' AND n->>'status' = 'unpaid' THEN
        RAISE EXCEPTION 'A paid bill cannot return to unpaid' USING ERRCODE = '23514';
      END IF;
      IF o->>'status' <> 'unpaid' AND (n->>'given_at',n->>'spent_at',n->>'received_at',n->>'method') IS DISTINCT FROM
         (o->>'given_at',o->>'spent_at',o->>'received_at',o->>'method') THEN
        RAISE EXCEPTION 'Void and replace a record to correct its payment date or method' USING ERRCODE = '23514';
      END IF;
      IF n->>'status' = 'voided' THEN
        NEW.voided_at := now(); NEW.reconciled_at := NULL; NEW.reconciliation_reference := NULL;
      END IF;
      IF NEW.reconciled_at IS NOT NULL AND (n->>'status' NOT IN ('completed','paid') OR nullif(btrim(NEW.reconciliation_reference),'') IS NULL) THEN
        RAISE EXCEPTION 'Only received or paid records with a statement reference can be reconciled' USING ERRCODE = '23514';
      END IF;
    END IF;
    -- A provider may add its receipt after confirmation; all user changes need a reason.
    IF NOT (src IN ('giving_payment','sms_purchase') AND n->>'reference' IS DISTINCT FROM o->>'reference'
      AND (n - ARRAY['reference','updated_at']) = (o - ARRAY['reference','updated_at']))
      AND nullif(btrim(NEW.change_reason),'') IS NULL THEN
      RAISE EXCEPTION 'A reason is required for finance changes' USING ERRCODE = '23514';
    END IF;
    NEW.updated_at := clock_timestamp();
    IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid(); END IF;
  END IF;

  IF TG_TABLE_NAME IN ('offerings','expenses','finance_income') THEN
    IF NEW.amount <= 0 AND (TG_OP = 'INSERT' OR NEW.amount IS DISTINCT FROM OLD.amount) THEN
      RAISE EXCEPTION 'Amount must be greater than zero' USING ERRCODE = '23514';
    END IF;
    IF NEW.currency IS NULL OR NEW.currency !~ '^[A-Z]{3}$' THEN
      RAISE EXCEPTION 'Use a three-letter currency code' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' THEN
      NEW.created_at := now(); NEW.updated_at := now();
      IF auth.uid() IS NOT NULL THEN NEW.recorded_by := auth.uid(); END IF;
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'expenses' THEN
    IF NEW.category_id IS NOT NULL THEN
      SELECT name INTO nm FROM public.expense_categories WHERE id = NEW.category_id AND church_id = NEW.church_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Expense category must belong to this church' USING ERRCODE = '23514'; END IF;
      IF TG_OP = 'INSERT' THEN NEW.category_name := nm; END IF;
    END IF;
    IF NEW.status = 'paid' AND NEW.spent_at IS NULL THEN RAISE EXCEPTION 'Enter the payment date' USING ERRCODE = '23514'; END IF;
    IF NEW.status = 'unpaid' THEN NEW.spent_at := NULL; END IF;
    IF NEW.due_date IS NOT NULL AND NEW.due_date < NEW.invoice_date THEN
      RAISE EXCEPTION 'Due date cannot be before the invoice date' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.recorded_by_name IS NULL THEN
      SELECT COALESCE(nullif(btrim(full_name),''),nullif(btrim(email),'')) INTO NEW.recorded_by_name FROM public.users WHERE id = NEW.recorded_by;
    END IF;
  ELSIF TG_TABLE_NAME = 'finance_income' THEN
    IF TG_OP = 'INSERT' AND NEW.recorded_by_name IS NULL THEN
      SELECT COALESCE(nullif(btrim(full_name),''),nullif(btrim(email),'')) INTO NEW.recorded_by_name FROM public.users WHERE id = NEW.recorded_by;
    END IF;
  ELSIF TG_TABLE_NAME = 'offerings' THEN
    IF TG_OP = 'INSERT' AND NEW.recorded_by_name IS NULL THEN
      SELECT COALESCE(nullif(btrim(full_name),''),nullif(btrim(email),'')) INTO NEW.recorded_by_name FROM public.users WHERE id = NEW.recorded_by;
    END IF;
    IF NEW.campaign_id IS NOT NULL THEN
      SELECT currency INTO expected_currency FROM public.campaigns WHERE id = NEW.campaign_id AND church_id = NEW.church_id;
      IF expected_currency IS DISTINCT FROM NEW.currency THEN RAISE EXCEPTION 'Giving and campaign currencies must match' USING ERRCODE = '23514'; END IF;
    END IF;
    IF NEW.pledge_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pledges p WHERE p.id = NEW.pledge_id AND p.church_id = NEW.church_id
      AND p.membership_id IS NOT DISTINCT FROM NEW.membership_id AND COALESCE(p.currency,'KES') = NEW.currency AND p.campaign_id IS NOT DISTINCT FROM NEW.campaign_id) THEN
      RAISE EXCEPTION 'Giving must match the pledge member, church, campaign and currency' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'pledges' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT COALESCE(nullif(btrim(m.full_name),''),nullif(btrim(u.full_name),''),nullif(btrim(m.email),''),nullif(btrim(u.email),''),'Member') INTO NEW.member_name
      FROM public.church_memberships m LEFT JOIN public.users u ON u.id = m.user_id
      WHERE m.id = NEW.membership_id AND m.church_id = NEW.church_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Pledge member must belong to this church' USING ERRCODE = '23514'; END IF;
    END IF;
    IF NEW.campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = NEW.campaign_id AND c.church_id = NEW.church_id AND c.currency = NEW.currency) THEN
      RAISE EXCEPTION 'Pledge campaign and currency must match this church' USING ERRCODE = '23514';
    END IF;
    IF NEW.ends_on < NEW.starts_on OR NEW.frequency NOT IN ('one_time','weekly','monthly','quarterly','annually') THEN
      RAISE EXCEPTION 'Invalid pledge schedule' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'campaigns' THEN
    IF NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'Campaign end date must follow its start date' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'finance_budgets' THEN
    PERFORM 1 FROM public.expense_categories WHERE id = NEW.category_id AND church_id = NEW.church_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Budget category must belong to this church' USING ERRCODE = '23514'; END IF;
    IF NEW.status = 'active' AND EXISTS (SELECT 1 FROM public.finance_budgets b WHERE b.church_id = NEW.church_id
      AND b.category_id = NEW.category_id AND b.currency = NEW.currency AND b.id <> NEW.id AND b.status = 'active'
      AND b.start_date <= NEW.end_date AND b.end_date >= NEW.start_date) THEN
      RAISE EXCEPTION 'An active budget already covers this category and period' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['offerings','expenses','finance_income','pledges','campaigns','finance_budgets'] LOOP
    EXECUTE format('CREATE TRIGGER finance_validate BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_guard_record()',tbl);
  END LOOP;
END $$;

-- Voiding keeps the original receipt identity; it no longer authorizes a receipt download.
CREATE OR REPLACE FUNCTION public.generate_receipt_number() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE seq TEXT;
BEGIN
  IF NEW.membership_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.church_memberships WHERE id = NEW.membership_id AND church_id = NEW.church_id) THEN
    RAISE EXCEPTION 'The giving member must belong to this church' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'voided' AND TG_OP = 'UPDATE' THEN NEW.receipt_number := OLD.receipt_number;
  ELSIF NEW.status NOT IN ('completed','test') THEN NEW.receipt_number := NULL;
  ELSIF NEW.receipt_number IS NULL THEN
    seq := nextval('public.receipt_number_seq')::TEXT;
    NEW.receipt_number := CASE WHEN NEW.status = 'test' THEN 'TEST-' ELSE 'RCP-' END || to_char(now() AT TIME ZONE 'Africa/Nairobi','YYYY') || '-' || lpad(seq,greatest(6,length(seq)),'0');
  END IF;
  IF NEW.receipt_details IS NULL THEN
    SELECT jsonb_build_object('church',jsonb_build_object('name',c.name,'logo_url',c.logo_url,'address',c.address,'phone',c.phone,'email',c.email),
      'campaign_name',(SELECT name FROM public.campaigns WHERE id = NEW.campaign_id AND church_id = NEW.church_id),
      'pledge_id',NEW.pledge_id,
      'donor',jsonb_build_object('full_name',COALESCE(nullif(btrim(NEW.donor_name),''),nullif(btrim(m.full_name),''),nullif(btrim(u.full_name),''),'Anonymous'),'email',COALESCE(nullif(btrim(m.email),''),u.email)))
      INTO NEW.receipt_details FROM public.churches c LEFT JOIN public.church_memberships m ON m.id = NEW.membership_id
      LEFT JOIN public.users u ON u.id = m.user_id WHERE c.id = NEW.church_id;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.finance_audit_record() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n JSONB := to_jsonb(NEW); o JSONB; actor UUID; nm TEXT; kind TEXT; act TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN o := to_jsonb(OLD); IF n = o THEN RETURN NEW; END IF; END IF;
  kind := CASE TG_TABLE_NAME WHEN 'offerings' THEN 'giving' WHEN 'expenses' THEN 'expense' WHEN 'finance_income' THEN 'income'
    WHEN 'finance_budgets' THEN 'budget' WHEN 'finance_documents' THEN 'document' WHEN 'expense_categories' THEN 'category'
    WHEN 'campaigns' THEN 'campaign' WHEN 'pledges' THEN 'pledge' END;
  actor := COALESCE(auth.uid(), (CASE WHEN TG_OP = 'UPDATE' THEN n->>'updated_by' ELSE COALESCE(n->>'recorded_by',n->>'created_by',n->>'uploaded_by') END)::UUID);
  SELECT COALESCE(nullif(btrim(full_name),''),nullif(btrim(email),'')) INTO nm FROM public.users WHERE id = actor;
  IF n->>'source' IN ('sms_purchase','event_registration','event_refund') OR n->>'payment_id' IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR n->>'source' IS DISTINCT FROM o->>'source'
      OR (n - ARRAY['reference','updated_at']) = (o - ARRAY['reference','updated_at']) THEN actor := NULL; nm := 'System'; END IF;
  END IF;
  act := CASE WHEN TG_OP = 'INSERT' THEN 'created' WHEN n->>'status' IN ('voided','cancelled') AND n->>'status' IS DISTINCT FROM o->>'status' THEN n->>'status'
    WHEN n->>'source' IS DISTINCT FROM o->>'source' THEN 'source_linked'
    WHEN n->>'status' = 'paid' AND o->>'status' = 'unpaid' THEN 'paid'
    WHEN n->>'reconciled_at' IS DISTINCT FROM o->>'reconciled_at' THEN CASE WHEN n->>'reconciled_at' IS NULL THEN 'unreconciled' ELSE 'reconciled' END ELSE 'updated' END;
  INSERT INTO public.finance_audit(church_id,entity_type,entity_id,action,actor_id,actor_name,reason,before_data,after_data)
  VALUES (NEW.church_id,kind,NEW.id,act,actor,COALESCE(nm,n->>'recorded_by_name','System'),n->>'change_reason',o,n);
  RETURN NEW;
END $$;
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['offerings','expenses','finance_income','pledges','campaigns','finance_budgets','expense_categories','finance_documents'] LOOP
    EXECUTE format('CREATE TRIGGER finance_history AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_audit_record()',tbl);
  END LOOP;
END $$;
-- A baseline snapshot distinguishes pre-existing data from newly entered records.
INSERT INTO public.finance_audit(church_id,entity_type,entity_id,action,actor_name,after_data)
SELECT church_id,'giving',id,'opening_record','Migration',to_jsonb(o) FROM public.offerings o
UNION ALL SELECT church_id,'expense',id,'opening_record','Migration',to_jsonb(e) FROM public.expenses e
UNION ALL SELECT church_id,'pledge',id,'opening_record','Migration',to_jsonb(p) FROM public.pledges p
UNION ALL SELECT church_id,'campaign',id,'opening_record','Migration',to_jsonb(c) FROM public.campaigns c;

CREATE OR REPLACE FUNCTION public.seed_default_expense_categories() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.expense_categories(church_id,name,color)
  SELECT NEW.id,v.name,v.color FROM (VALUES
    ('Electricity','#0ea5e9'),('Water','#06b6d4'),('Transport','#f97316'),('Salaries','#8b5cf6'),
    ('Rent','#a855f7'),('Internet and telephone','#0284c7'),('SMS credits','#6366f1'),('Ministry','#ec4899'),
    ('Maintenance','#f59e0b'),('Outreach','#10b981'),('Events','#ef4444'),('Event refunds','#fb7185'),
    ('Office supplies','#64748b'),('Bank and payment fees','#78716c'),('Other','#6b7280')) v(name,color)
  ON CONFLICT(church_id,name) DO NOTHING;
  RETURN NEW;
END $$;
INSERT INTO public.expense_categories(church_id,name,color)
SELECT c.id,v.name,v.color FROM public.churches c CROSS JOIN (VALUES
  ('Electricity','#0ea5e9'),('Water','#06b6d4'),('Transport','#f97316'),('Salaries','#8b5cf6'),
  ('Rent','#a855f7'),('Internet and telephone','#0284c7'),('SMS credits','#6366f1'),('Event refunds','#fb7185'),
  ('Office supplies','#64748b'),('Bank and payment fees','#78716c'),('Other','#6b7280')) v(name,color)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories e WHERE e.church_id = c.id AND lower(e.name) = lower(v.name));

-- Credit purchases are cash expenses exactly once. SMS usage is not charged again.
CREATE FUNCTION public.finance_capture_sms_purchase() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cat UUID; matches UUID[];
BEGIN
  IF NEW.status <> 'paid' OR NEW.environment <> 'production' THEN RETURN NEW; END IF;
  IF nullif(btrim(NEW.receipt),'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.expenses
    WHERE church_id = NEW.church_id AND source = 'sms_purchase' AND source_id = NEW.id) THEN
    SELECT array_agg(e.id) INTO matches FROM (SELECT id FROM public.expenses
      WHERE church_id = NEW.church_id AND source = 'manual' AND status = 'paid' AND method = 'mpesa'
        AND amount = NEW.amount_kes AND COALESCE(currency,'KES') = 'KES'
        AND upper(btrim(reference)) = upper(btrim(NEW.receipt)) FOR UPDATE) e;
    IF cardinality(matches) = 1 THEN
      UPDATE public.expenses SET source = 'sms_purchase', source_id = NEW.id WHERE id = matches[1];
    END IF;
  END IF;
  INSERT INTO public.expense_categories(church_id,name,color) VALUES(NEW.church_id,'SMS credits','#6366f1') ON CONFLICT(church_id,name) DO NOTHING;
  SELECT id INTO cat FROM public.expense_categories WHERE church_id = NEW.church_id AND name = 'SMS credits';
  INSERT INTO public.expenses(church_id,category_id,amount,currency,description,method,reference,spent_at,invoice_date,payee,notes,source,source_id,recorded_by,recorded_by_name)
  VALUES(NEW.church_id,cat,NEW.amount_kes,'KES',NEW.credits::TEXT || ' SMS credits','mpesa',NEW.receipt,
    COALESCE(NEW.paid_at,NEW.created_at),(COALESCE(NEW.paid_at,NEW.created_at) AT TIME ZONE 'Africa/Nairobi')::DATE,
    'ChurchOnline SMS','Automatically recorded from a confirmed production SMS purchase.' || CASE WHEN cardinality(matches) > 1
      THEN ' Multiple manual records have the same receipt and amount; review them for duplicate entry.' ELSE '' END,
    'sms_purchase',NEW.id,NEW.created_by,NEW.created_by_name)
  ON CONFLICT(church_id,source,source_id) WHERE source_id IS NOT NULL DO NOTHING;
  IF NEW.receipt IS NOT NULL THEN UPDATE public.expenses SET reference = NEW.receipt WHERE church_id = NEW.church_id AND source = 'sms_purchase'
    AND source_id = NEW.id AND reference IS DISTINCT FROM NEW.receipt; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_sms_paid AFTER INSERT OR UPDATE ON public.sms_purchases FOR EACH ROW EXECUTE FUNCTION public.finance_capture_sms_purchase();
-- Run capture for older confirmations too; the unique source link prevents duplication.
UPDATE public.sms_purchases SET receipt = receipt WHERE status = 'paid' AND environment = 'production';

-- Registration receipts are separate from voluntary giving. Refunds retain both cash movements.
ALTER TABLE public.event_registrations ADD COLUMN paid_at TIMESTAMPTZ, ADD COLUMN refunded_at TIMESTAMPTZ;
CREATE FUNCTION public.finance_event_payment_dates() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status = 'paid' AND NEW.payment_status NOT IN ('paid','refunded') THEN
      RAISE EXCEPTION 'A paid registration must retain its payment or record a refund' USING ERRCODE = '23514';
    END IF;
    IF OLD.payment_status = 'refunded' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'A refunded registration cannot be paid again; create a new registration' USING ERRCODE = '23514';
    END IF;
    IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN NEW.paid_at := COALESCE(NEW.paid_at,now()); END IF;
    IF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN NEW.refunded_at := COALESCE(NEW.refunded_at,now()); END IF;
    IF OLD.payment_status IN ('paid','refunded') AND (NEW.event_id,NEW.amount_paid,NEW.paid_at) IS DISTINCT FROM (OLD.event_id,OLD.amount_paid,OLD.paid_at) THEN
      RAISE EXCEPTION 'A recorded event payment identity and amount cannot change' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.payment_status = 'paid' THEN NEW.paid_at := COALESCE(NEW.paid_at,now()); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_event_payment_dates BEFORE INSERT OR UPDATE ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION public.finance_event_payment_dates();
REVOKE ALL ON FUNCTION public.finance_event_payment_dates() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.finance_capture_event_payment() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ev public.events; cat UUID; received public.finance_income;
BEGIN
  IF NEW.payment_status NOT IN ('paid','refunded') THEN RETURN NEW; END IF;
  SELECT * INTO ev FROM public.events WHERE id = NEW.event_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.has_giving_finance_permission(ev.church_id,'finance:write') THEN
    RAISE EXCEPTION 'Finance permission is required to record event payments' USING ERRCODE = '42501';
  END IF;
  IF NEW.payment_status = 'paid' THEN
    IF NEW.amount_paid IS NULL OR NEW.amount_paid <= 0 THEN RAISE EXCEPTION 'A paid registration requires a positive received amount' USING ERRCODE = '23514'; END IF;
    INSERT INTO public.finance_income(church_id,category,description,payee,amount,currency,method,reference,received_at,source,source_id,notes)
    VALUES(ev.church_id,'Event fees',ev.title,COALESCE(NEW.guest_name,'Event attendee'),NEW.amount_paid,COALESCE(ev.currency,'KES'),'other',NEW.payment_reference,
      COALESCE(NEW.paid_at,NEW.created_at,now()),'event_registration',NEW.id,CASE WHEN NEW.paid_at IS NULL
        THEN 'Imported historical event receipt. The original payment date was not recorded; the registration date is used.'
        ELSE 'Automatically captured from the event registration payment record.' END)
    ON CONFLICT(church_id,source,source_id) DO NOTHING;
    SELECT * INTO received FROM public.finance_income WHERE church_id = ev.church_id AND source = 'event_registration' AND source_id = NEW.id;
    IF received.amount <> NEW.amount_paid OR received.reference IS DISTINCT FROM NEW.payment_reference THEN
      RAISE EXCEPTION 'A recorded event payment cannot be changed; record its refund separately' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'paid' THEN
    SELECT * INTO received FROM public.finance_income WHERE church_id = ev.church_id AND source = 'event_registration' AND source_id = NEW.id;
    IF FOUND THEN
      SELECT id INTO cat FROM public.expense_categories WHERE church_id = ev.church_id AND name = 'Event refunds';
      INSERT INTO public.expenses(church_id,category_id,amount,currency,description,payee,method,spent_at,invoice_date,source,source_id,notes)
      VALUES(ev.church_id,cat,received.amount,received.currency,'Refund: ' || received.description,received.payee,'other',COALESCE(NEW.refunded_at,now()),
        (COALESCE(NEW.refunded_at,now()) AT TIME ZONE 'Africa/Nairobi')::DATE,'event_refund',NEW.id,'Automatically captured when the registration was marked refunded.')
      ON CONFLICT(church_id,source,source_id) WHERE source_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_event_paid AFTER INSERT OR UPDATE OF payment_status,amount_paid,payment_reference ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.finance_capture_event_payment();
-- Import only receipts with a known received amount; incomplete legacy records need review.
UPDATE public.event_registrations SET payment_reference = payment_reference WHERE payment_status = 'paid' AND amount_paid > 0;

-- Functions used only as triggers cannot be called as public RPCs.
REVOKE ALL ON FUNCTION public.finance_guard_record(), public.finance_audit_record(), public.finance_preserve_record(),
  public.finance_capture_sms_purchase(), public.finance_capture_event_payment() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.finance_immutable_history() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'finance_audit' AND (to_jsonb(NEW)->>'actor_id') IS NULL AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'finance_documents' AND (to_jsonb(NEW)->>'uploaded_by') IS NULL AND (to_jsonb(NEW) - 'uploaded_by') = (to_jsonb(OLD) - 'uploaded_by') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Finance history and filed documents are immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER finance_audit_immutable BEFORE UPDATE ON public.finance_audit FOR EACH ROW EXECUTE FUNCTION public.finance_immutable_history();
CREATE TRIGGER finance_documents_immutable BEFORE UPDATE ON public.finance_documents FOR EACH ROW EXECUTE FUNCTION public.finance_immutable_history();
REVOKE ALL ON FUNCTION public.finance_immutable_history() FROM PUBLIC,anon,authenticated;

-- Allocate online gifts to the same campaigns and pledges as manual receipts.
ALTER TABLE public.giving_payments
  ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN pledge_id UUID REFERENCES public.pledges(id) ON DELETE SET NULL;
CREATE FUNCTION public.finance_giving_allocation() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.campaign_id,NEW.pledge_id) IS DISTINCT FROM (OLD.campaign_id,OLD.pledge_id)
      AND EXISTS (SELECT 1 FROM public.churches WHERE id = OLD.church_id) THEN
      RAISE EXCEPTION 'The allocation of a payment request cannot change' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = NEW.campaign_id
    AND c.church_id = NEW.church_id AND COALESCE(c.currency,'KES') = 'KES' AND c.status = 'active') THEN
    RAISE EXCEPTION 'Select an active KES campaign in this church' USING ERRCODE = '23514';
  END IF;
  IF NEW.pledge_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pledges p WHERE p.id = NEW.pledge_id
    AND p.church_id = NEW.church_id AND p.membership_id = NEW.membership_id AND COALESCE(p.currency,'KES') = 'KES'
    AND p.campaign_id IS NOT DISTINCT FROM NEW.campaign_id AND p.status = 'active') THEN
    RAISE EXCEPTION 'Select a matching active pledge for this member' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER finance_giving_allocation BEFORE INSERT OR UPDATE ON public.giving_payments FOR EACH ROW EXECUTE FUNCTION public.finance_giving_allocation();
REVOKE ALL ON FUNCTION public.finance_giving_allocation() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.confirm_giving_payment(p_id UUID,p_checkout TEXT,p_receipt TEXT DEFAULT NULL,p_paid_at TIMESTAMPTZ DEFAULT NULL)
RETURNS public.giving_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE payment public.giving_payments; offering UUID;
BEGIN
  SELECT * INTO payment FROM public.giving_payments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR payment.checkout_request_id IS DISTINCT FROM p_checkout OR p_checkout IS NULL THEN
    RAISE EXCEPTION 'Payment checkout does not match' USING ERRCODE = '23514';
  END IF;
  IF p_receipt IS NOT NULL AND p_receipt !~ '^[A-Z0-9]{8,20}$' THEN RAISE EXCEPTION 'Invalid payment receipt' USING ERRCODE = '23514'; END IF;
  IF payment.mpesa_receipt IS NOT NULL AND p_receipt IS NOT NULL AND payment.mpesa_receipt <> p_receipt THEN
    RAISE EXCEPTION 'Payment receipt does not match' USING ERRCODE = '23514';
  END IF;
  IF payment.offering_id IS NULL THEN
    INSERT INTO public.offerings(church_id,membership_id,amount,currency,type,method,status,payment_id,reference,given_at,receipt_details,notes,campaign_id,pledge_id)
    VALUES(payment.church_id,payment.membership_id,payment.amount,'KES',payment.type,'mpesa',CASE WHEN payment.environment = 'sandbox' THEN 'test' ELSE 'completed' END,
      payment.id,p_receipt,COALESCE(p_paid_at,now()),payment.receipt_details,
      CASE WHEN payment.environment = 'sandbox' THEN 'Sandbox payment: no money received' ELSE 'M-Pesa confirmed' END,payment.campaign_id,payment.pledge_id)
    RETURNING id INTO offering;
  ELSE
    offering := payment.offering_id;
    IF p_receipt IS NOT NULL THEN UPDATE public.offerings SET reference = p_receipt WHERE id = offering; END IF;
  END IF;
  UPDATE public.giving_payments SET status = 'succeeded',offering_id = offering,mpesa_receipt = COALESCE(mpesa_receipt,p_receipt),result_code = 0,error = NULL,
    confirmed_at = COALESCE(confirmed_at,p_paid_at,now()) WHERE id = payment.id RETURNING * INTO payment;
  RETURN payment;
END $$;
