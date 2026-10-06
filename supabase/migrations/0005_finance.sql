-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE offering_type AS ENUM (
  'tithe', 'general', 'missions', 'building_fund',
  'welfare', 'thanksgiving', 'pledge', 'other'
);
CREATE TYPE payment_method AS ENUM (
  'cash', 'mpesa', 'bank_transfer', 'cheque', 'card', 'online', 'other'
);
CREATE TYPE campaign_status AS ENUM ('active', 'completed', 'paused', 'cancelled');

-- ============================================
-- EXPENSE CATEGORIES (per church)
-- ============================================
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, name)
);

-- ============================================
-- OFFERINGS
-- ============================================
CREATE TABLE public.offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.church_memberships(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'KES',
  type offering_type NOT NULL DEFAULT 'general',
  method payment_method NOT NULL DEFAULT 'cash',
  campaign_id UUID,
  pledge_id UUID,
  reference TEXT,
  notes TEXT,
  receipt_number TEXT UNIQUE,
  given_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offerings_church_date ON public.offerings(church_id, given_at DESC);
CREATE INDEX idx_offerings_member ON public.offerings(membership_id);
CREATE INDEX idx_offerings_campaign ON public.offerings(campaign_id);
CREATE INDEX idx_offerings_type ON public.offerings(church_id, type);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'KES',
  description TEXT NOT NULL,
  method payment_method DEFAULT 'cash',
  reference TEXT,
  receipt_url TEXT,
  spent_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_church_date ON public.expenses(church_id, spent_at DESC);
CREATE INDEX idx_expenses_category ON public.expenses(church_id, category_id);

-- ============================================
-- CAMPAIGNS (giving goals)
-- ============================================
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal_amount NUMERIC(12, 2) NOT NULL CHECK (goal_amount > 0),
  currency TEXT DEFAULT 'KES',
  start_date DATE NOT NULL,
  end_date DATE,
  status campaign_status DEFAULT 'active',
  image_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_church ON public.campaigns(church_id, status);

-- ============================================
-- PLEDGES (commitments)
-- ============================================
CREATE TABLE public.pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.church_memberships(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount_pledged NUMERIC(12, 2) NOT NULL CHECK (amount_pledged > 0),
  currency TEXT DEFAULT 'KES',
  frequency TEXT DEFAULT 'one_time', -- one_time | weekly | monthly | quarterly | annually
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pledges_church ON public.pledges(church_id);
CREATE INDEX idx_pledges_member ON public.pledges(membership_id);
CREATE INDEX idx_pledges_campaign ON public.pledges(campaign_id);

-- ============================================
-- Foreign key backfills
-- ============================================
ALTER TABLE public.offerings
  ADD CONSTRAINT offerings_campaign_fk FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD CONSTRAINT offerings_pledge_fk FOREIGN KEY (pledge_id)
    REFERENCES public.pledges(id) ON DELETE SET NULL;

-- ============================================
-- RECEIPT NUMBER SEQUENCE
-- ============================================
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL AND NEW.membership_id IS NOT NULL THEN
    NEW.receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(nextval('receipt_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_offerings_receipt
  BEFORE INSERT ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

-- Expense categories
CREATE POLICY "expense_categories_read" ON public.expense_categories
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid())
  );
CREATE POLICY "expense_categories_admin_write" ON public.expense_categories
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

-- Offerings: admins full access; members read their own
CREATE POLICY "offerings_admin_all" ON public.offerings
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

CREATE POLICY "offerings_member_read_own" ON public.offerings
  FOR SELECT USING (
    membership_id IN (
      SELECT id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

-- Expenses: admins only
CREATE POLICY "expenses_admin_all" ON public.expenses
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

-- Campaigns: read for church members; write for admins
CREATE POLICY "campaigns_read" ON public.campaigns
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM public.church_memberships WHERE user_id = auth.uid())
  );
CREATE POLICY "campaigns_admin_write" ON public.campaigns
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

-- Pledges: admins full; members read own
CREATE POLICY "pledges_admin_all" ON public.pledges
  FOR ALL USING (public.is_church_admin(church_id))
  WITH CHECK (public.is_church_admin(church_id));

CREATE POLICY "pledges_member_read_own" ON public.pledges
  FOR SELECT USING (
    membership_id IN (
      SELECT id FROM public.church_memberships WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- DEFAULT EXPENSE CATEGORIES
-- ============================================
CREATE OR REPLACE FUNCTION public.seed_default_expense_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.expense_categories (church_id, name, color) VALUES
    (NEW.id, 'Utilities', '#0ea5e9'),
    (NEW.id, 'Salaries', '#8b5cf6'),
    (NEW.id, 'Ministry', '#ec4899'),
    (NEW.id, 'Maintenance', '#f59e0b'),
    (NEW.id, 'Outreach', '#10b981'),
    (NEW.id, 'Events', '#ef4444'),
    (NEW.id, 'Other', '#6b7280');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_expense_categories
  AFTER INSERT ON public.churches
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_expense_categories();