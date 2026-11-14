import {
  givingFixture,
  givingId,
  givingChurch,
  givingAdmin,
} from './giving-fixture'
import { FinanceEngine } from '../../src/modules/finance/finance-engine'
import type {
  FinanceEntry,
  FinanceSummary,
} from '../../src/modules/finance/finance.types'
export {
  givingId as financeId,
  givingChurch as financeChurch,
  givingAdmin as financeAdmin,
}
export function financeRow(
  n = 1,
  changes: Partial<FinanceEntry> = {}
): FinanceEntry {
  return {
    entry_key: `expense:${givingId(20000 + n)}`,
    id: givingId(20000 + n),
    church_id: givingChurch,
    kind: 'expense',
    direction: 'expense',
    amount: 12.35,
    currency: 'KES',
    category: 'Electricity',
    category_id: givingId(7000),
    giving_type: null,
    campaign_id: null,
    campaign_name: null,
    pledge_id: null,
    source: 'manual',
    source_id: null,
    status: 'completed',
    method: 'cash',
    reference: `REF-${n}`,
    voucher_number: `EXP-${n}`,
    occurred_at: '2025-01-15T12:00:00.000Z',
    entry_date: '2025-01-15',
    payee: `Supplier ${n}`,
    description: 'Electricity bill',
    notes: null,
    invoice_number: `INV-${n}`,
    invoice_date: '2025-01-14',
    due_date: null,
    period_start: '2025-01-01',
    period_end: '2025-01-31',
    recorded_by: givingAdmin,
    recorded_by_name: 'Treasurer',
    created_at: '2025-01-15T12:00:00.000Z',
    updated_at: '2025-01-15T12:00:00.000Z',
    voided_at: null,
    change_reason: null,
    reconciled_at: null,
    reconciliation_reference: null,
    document_count: 0,
    legacy_receipt_url: null,
    ...changes,
  }
}
export const financeSummary: FinanceSummary = {
  currency: 'KES',
  totalIncome: 100.3,
  totalExpense: 12.35,
  netBalance: 87.95,
  openingBalance: 200,
  closingBalance: 287.95,
  completedCount: 3,
  unreconciledCount: 1,
  missingDocumentsCount: 1,
  excludedCount: 2,
  manualCount: 1,
  automaticCount: 2,
  outstandingBills: 40,
  outstandingBillCount: 1,
  overdueBills: 20,
  byType: [{ type: 'general', kind: 'giving', total: 100.3, count: 2 }],
  byCategory: [
    { name: 'Electricity', color: '#6366f1', total: 12.35, count: 1 },
  ],
  byMethod: [{ method: 'cash', income: 100.3, expense: 12.35 }],
  monthly: [{ month: '2025-01', income: 100.3, expense: 12.35 }],
}
export function financeFixture() {
  const f = givingFixture(),
    uploaded: string[] = [],
    removed: string[] = [],
    signed: string[] = []
  Object.assign(f.tables, {
    finance_register: [],
    finance_audit: [],
    finance_documents: [],
    expenses: [],
    finance_income: [],
    finance_budget_progress: [],
    finance_pledge_progress: [],
    finance_campaign_progress: [],
    finance_budgets: [],
    pledges: [],
    campaigns: [],
    expense_categories: [
      {
        id: givingId(7000),
        church_id: givingChurch,
        name: 'Electricity',
        color: '#6366f1',
      },
    ],
  })
  const rpcCalls: { name: string; args: unknown }[] = []
  const db = {
    from: f.db.from.bind(f.db),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args })
      return { data: financeSummary, error: null }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploaded.push(path)
          return { data: { path }, error: null }
        },
        remove: async (paths: string[]) => {
          removed.push(...paths)
          return { data: [], error: null }
        },
        createSignedUrl: async (path: string) => {
          signed.push(path)
          return {
            data: {
              signedUrl: `https://files.example.test/${path}?token=short-lived`,
            },
            error: null,
          }
        },
      }),
    },
  }
  return {
    ...f,
    db,
    engine: new FinanceEngine(db),
    rpcCalls,
    uploaded,
    removed,
    signed,
  }
}
