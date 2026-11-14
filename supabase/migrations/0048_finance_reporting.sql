-- Server-only views. Both API clients authorize the caller before querying them.
CREATE VIEW public.finance_register AS
SELECT r.*, concat_ws(' ',r.payee,r.description,r.category,r.reference,r.voucher_number,r.invoice_number,r.campaign_name,r.notes) AS search_text FROM (
SELECT 'giving:' || o.id::TEXT AS entry_key, o.id, o.church_id, 'giving'::TEXT AS kind, 'income'::TEXT AS direction,
  o.amount, COALESCE(o.currency,'KES') AS currency, o.type::TEXT AS category, NULL::UUID AS category_id,
  o.type::TEXT AS giving_type, o.campaign_id, c.name AS campaign_name, o.pledge_id,
  CASE WHEN o.payment_id IS NULL THEN 'manual' ELSE 'giving_payment' END AS source, o.payment_id AS source_id,
  o.status, o.method::TEXT, o.reference, o.receipt_number AS voucher_number,
  COALESCE(o.given_at,o.created_at) AS occurred_at,
  (COALESCE(o.given_at,o.created_at) AT TIME ZONE 'Africa/Nairobi')::DATE AS entry_date,
  COALESCE(o.donor_name,o.receipt_details #>> '{donor,full_name}','Anonymous') AS payee,
  'Giving'::TEXT AS description, o.notes,
  NULL::TEXT AS invoice_number, NULL::DATE AS invoice_date, NULL::DATE AS due_date, NULL::DATE AS period_start, NULL::DATE AS period_end,
  o.recorded_by, COALESCE(o.recorded_by_name,CASE WHEN o.payment_id IS NOT NULL THEN 'System' ELSE 'Not recorded' END) AS recorded_by_name,
  COALESCE(o.created_at,o.given_at,'epoch'::TIMESTAMPTZ) AS created_at, o.updated_at, o.voided_at, o.change_reason,
  o.reconciled_at, o.reconciliation_reference,
  (SELECT count(*)::INTEGER FROM public.finance_documents d WHERE d.church_id = o.church_id AND d.entity_type = 'giving' AND d.entity_id = o.id) AS document_count,
  NULL::TEXT AS legacy_receipt_url
FROM public.offerings o LEFT JOIN public.campaigns c ON c.id = o.campaign_id AND c.church_id = o.church_id
UNION ALL
SELECT 'expense:' || e.id::TEXT, e.id, e.church_id, 'expense','expense',e.amount,COALESCE(e.currency,'KES'),
  COALESCE(e.category_name,c.name,'Uncategorized'),e.category_id,NULL::TEXT,NULL::UUID,NULL::TEXT,NULL::UUID,
  e.source,e.source_id,CASE WHEN e.status = 'paid' THEN 'completed' ELSE e.status END,COALESCE(e.method::TEXT,'other'),e.reference,e.voucher_number,
  COALESCE(e.spent_at,e.invoice_date::TIMESTAMP AT TIME ZONE 'Africa/Nairobi'),
  COALESCE((e.spent_at AT TIME ZONE 'Africa/Nairobi')::DATE,e.invoice_date),e.payee,e.description,e.notes,
  e.invoice_number,e.invoice_date,e.due_date,e.period_start,e.period_end,e.recorded_by,COALESCE(e.recorded_by_name,'Not recorded'),
  COALESCE(e.created_at,e.spent_at,'epoch'::TIMESTAMPTZ),e.updated_at,e.voided_at,e.change_reason,e.reconciled_at,e.reconciliation_reference,
  (SELECT count(*)::INTEGER FROM public.finance_documents d WHERE d.church_id = e.church_id AND d.entity_type = 'expense' AND d.entity_id = e.id),e.receipt_url
FROM public.expenses e LEFT JOIN public.expense_categories c ON c.id = e.category_id AND c.church_id = e.church_id
UNION ALL
SELECT 'income:' || i.id::TEXT,i.id,i.church_id,'income','income',i.amount,i.currency,i.category,NULL::UUID,NULL::TEXT,NULL::UUID,NULL::TEXT,NULL::UUID,
  i.source,i.source_id,i.status,i.method::TEXT,i.reference,i.voucher_number,i.received_at,(i.received_at AT TIME ZONE 'Africa/Nairobi')::DATE,
  i.payee,i.description,i.notes,NULL::TEXT,NULL::DATE,NULL::DATE,NULL::DATE,NULL::DATE,
  i.recorded_by,COALESCE(i.recorded_by_name,CASE WHEN i.source <> 'manual' THEN 'System' ELSE 'Not recorded' END),
  i.created_at,i.updated_at,i.voided_at,i.change_reason,i.reconciled_at,i.reconciliation_reference,
  (SELECT count(*)::INTEGER FROM public.finance_documents d WHERE d.church_id = i.church_id AND d.entity_type = 'income' AND d.entity_id = i.id),NULL::TEXT
FROM public.finance_income i) r;
REVOKE ALL ON public.finance_register FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.finance_register TO service_role;

CREATE VIEW public.finance_campaign_progress AS
SELECT c.*, COALESCE((SELECT sum(o.amount) FROM public.offerings o WHERE o.campaign_id = c.id AND o.church_id = c.church_id
  AND COALESCE(o.currency,'KES') = COALESCE(c.currency,'KES') AND o.status = 'completed'),0) AS raised
FROM public.campaigns c;
CREATE VIEW public.finance_pledge_progress AS
SELECT p.*, c.name AS campaign_name, COALESCE((SELECT sum(o.amount) FROM public.offerings o WHERE o.pledge_id = p.id AND o.church_id = p.church_id
  AND COALESCE(o.currency,'KES') = COALESCE(p.currency,'KES') AND o.status = 'completed'),0) AS received
FROM public.pledges p LEFT JOIN public.campaigns c ON c.id = p.campaign_id AND c.church_id = p.church_id;
CREATE VIEW public.finance_budget_progress AS
SELECT b.*, c.name AS category_name, COALESCE((SELECT sum(e.amount) FROM public.expenses e WHERE e.church_id = b.church_id
  AND e.category_id = b.category_id AND COALESCE(e.currency,'KES') = b.currency AND e.status = 'paid'
  AND e.spent_at >= b.start_date::TIMESTAMP AT TIME ZONE 'Africa/Nairobi'
  AND e.spent_at < (b.end_date + 1)::TIMESTAMP AT TIME ZONE 'Africa/Nairobi'),0) AS spent
FROM public.finance_budgets b JOIN public.expense_categories c ON c.id = b.category_id AND c.church_id = b.church_id;
REVOKE ALL ON public.finance_campaign_progress,public.finance_pledge_progress,public.finance_budget_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.finance_campaign_progress,public.finance_pledge_progress,public.finance_budget_progress TO service_role;

-- All totals are numeric aggregates in a single database snapshot, never a capped list.
CREATE FUNCTION public.finance_summary(p_church UUID,p_from TIMESTAMPTZ,p_to TIMESTAMPTZ,p_currency TEXT DEFAULT 'KES')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result JSONB;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to OR p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Choose a valid period and currency' USING ERRCODE = '23514';
  END IF;
  WITH entries AS MATERIALIZED (
    SELECT * FROM public.finance_register WHERE church_id = p_church AND currency = p_currency AND occurred_at < p_to
  ), period AS MATERIALIZED (
    SELECT * FROM entries WHERE occurred_at >= p_from
  ), totals AS (
    SELECT COALESCE(sum(amount) FILTER(WHERE direction = 'income' AND status = 'completed'),0) AS income,
      COALESCE(sum(amount) FILTER(WHERE direction = 'expense' AND status = 'completed'),0) AS expense,
      count(*) FILTER(WHERE status = 'completed') AS completed,
      count(*) FILTER(WHERE status = 'completed' AND reconciled_at IS NULL) AS unreconciled,
      count(*) FILTER(WHERE status = 'completed' AND kind = 'expense' AND document_count = 0 AND legacy_receipt_url IS NULL) AS missing_documents,
      count(*) FILTER(WHERE status IN ('test','pending','failed','review','voided')) AS excluded,
      count(*) FILTER(WHERE status = 'completed' AND source = 'manual') AS manual,
      count(*) FILTER(WHERE status = 'completed' AND source <> 'manual') AS automatic
    FROM period
  ), opening AS (
    SELECT COALESCE(sum(CASE WHEN direction = 'income' THEN amount ELSE -amount END),0) AS balance
    FROM entries WHERE occurred_at < p_from AND status = 'completed'
  ), bills AS (
    SELECT COALESCE(sum(amount),0) AS outstanding, count(*) AS bill_count,
      COALESCE(sum(amount) FILTER(WHERE due_date < (p_to AT TIME ZONE 'Africa/Nairobi')::DATE),0) AS overdue
    FROM public.expenses WHERE church_id = p_church AND COALESCE(currency,'KES') = p_currency
      AND invoice_date < (p_to AT TIME ZONE 'Africa/Nairobi')::DATE
      AND (status = 'unpaid' OR (status = 'paid' AND spent_at >= p_to))
  )
  SELECT jsonb_build_object(
    'currency',p_currency,'totalIncome',t.income,'totalExpense',t.expense,'netBalance',t.income-t.expense,
    'openingBalance',o.balance,'closingBalance',o.balance+t.income-t.expense,
    'completedCount',t.completed,'unreconciledCount',t.unreconciled,'missingDocumentsCount',t.missing_documents,
    'excludedCount',t.excluded,'manualCount',t.manual,'automaticCount',t.automatic,
    'outstandingBills',b.outstanding,'outstandingBillCount',b.bill_count,'overdueBills',b.overdue,
    'byType',COALESCE((SELECT jsonb_agg(v ORDER BY v.type) FROM (
      SELECT category AS type,kind,sum(amount) AS total,count(*) AS count FROM period WHERE direction = 'income' AND status = 'completed' GROUP BY category,kind
    ) v),'[]'::JSONB),
    'byCategory',COALESCE((SELECT jsonb_agg(v ORDER BY v.name) FROM (
      SELECT p.category AS name,COALESCE(c.color,'#94a3b8') AS color,sum(p.amount) AS total,count(*) AS count
      FROM period p LEFT JOIN public.expense_categories c ON c.id = p.category_id AND c.church_id = p.church_id
      WHERE p.direction = 'expense' AND p.status = 'completed' GROUP BY p.category,c.color
    ) v),'[]'::JSONB),
    'byMethod',COALESCE((SELECT jsonb_agg(v ORDER BY v.method) FROM (
      SELECT method,COALESCE(sum(amount) FILTER(WHERE direction = 'income'),0) AS income,
        COALESCE(sum(amount) FILTER(WHERE direction = 'expense'),0) AS expense FROM period WHERE status = 'completed' GROUP BY method
    ) v),'[]'::JSONB),
    'monthly',COALESCE((SELECT jsonb_agg(v ORDER BY v.month) FROM (
      SELECT to_char(m,'YYYY-MM') AS month,
        COALESCE(sum(p.amount) FILTER(WHERE p.direction = 'income'),0) AS income,
        COALESCE(sum(p.amount) FILTER(WHERE p.direction = 'expense'),0) AS expense
      FROM generate_series(date_trunc('month',p_from AT TIME ZONE 'Africa/Nairobi'),
        date_trunc('month',(p_to - interval '1 microsecond') AT TIME ZONE 'Africa/Nairobi'),interval '1 month') m
      LEFT JOIN period p ON date_trunc('month',p.occurred_at AT TIME ZONE 'Africa/Nairobi') = m AND p.status = 'completed'
      GROUP BY m
    ) v),'[]'::JSONB)
  ) INTO result FROM totals t CROSS JOIN opening o CROSS JOIN bills b;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.finance_summary(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_summary(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO service_role;
