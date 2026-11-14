import type {
  FinanceAudit,
  FinanceBudget,
  FinanceCampaign,
  FinanceDocument,
  FinanceEntry,
  FinancePledge,
  FinanceSummary,
} from './finance.types'

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Row>
  Update: Partial<Row>
  Relationships: []
}
type Income = Pick<
  FinanceEntry,
  | 'id'
  | 'church_id'
  | 'amount'
  | 'currency'
  | 'category'
  | 'description'
  | 'payee'
  | 'method'
  | 'reference'
  | 'notes'
  | 'source'
  | 'source_id'
  | 'recorded_by'
  | 'recorded_by_name'
  | 'created_at'
  | 'updated_at'
  | 'change_reason'
  | 'voided_at'
  | 'reconciled_at'
  | 'reconciliation_reference'
> & {
  request_id: string | null
  received_at: string
  status: 'completed' | 'voided'
  voucher_number: string
  updated_by: string | null
}
type Budget = Omit<FinanceBudget, 'spent' | 'category_name'> & {
  church_id: string
  request_id: string
  created_by: string | null
  updated_by: string | null
  change_reason: string | null
}
type Document = FinanceDocument & { uploaded_by: string | null }
export type FinanceTables = {
  finance_income: Table<
    Income,
    'church_id' | 'amount' | 'category' | 'description'
  >
  finance_budgets: Table<
    Budget,
    | 'church_id'
    | 'request_id'
    | 'category_id'
    | 'amount'
    | 'start_date'
    | 'end_date'
  >
  finance_documents: Table<
    Document,
    | 'church_id'
    | 'entity_type'
    | 'entity_id'
    | 'file_path'
    | 'file_name'
    | 'mime_type'
    | 'size_bytes'
    | 'uploaded_by_name'
  >
  finance_audit: Table<
    FinanceAudit,
    'church_id' | 'entity_type' | 'entity_id' | 'action' | 'actor_name'
  >
}
export type FinanceViews = {
  finance_register: {
    Row: FinanceEntry & { search_text: string }
    Relationships: []
  }
  finance_campaign_progress: {
    Row: FinanceCampaign & { church_id: string }
    Relationships: []
  }
  finance_pledge_progress: {
    Row: FinancePledge & { church_id: string }
    Relationships: []
  }
  finance_budget_progress: {
    Row: FinanceBudget & { church_id: string }
    Relationships: []
  }
}
export type FinanceFunctions = {
  finance_summary: {
    Args: {
      p_church: string
      p_from: string
      p_to: string
      p_currency?: string
    }
    Returns: FinanceSummary
  }
}
