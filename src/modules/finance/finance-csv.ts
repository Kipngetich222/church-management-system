import {
  PAYMENT_LABELS,
  SOURCE_LABELS,
  financeCategory,
  financePaymentLabel,
  type FinanceAudit,
  type FinanceEntry,
  type FinancePeriod,
  type FinanceSummary,
} from './finance.types'
import { givingLabel } from '../giving/giving.types'

export function financeCsvRow(values: unknown[]) {
  return (
    values
      .map((value) => {
        let text =
          typeof value === 'number' ? value.toFixed(2) : String(value ?? '')
        if (typeof value !== 'number' && /^[\s\uFEFF]*[=+@-]/.test(text))
          text = `'${text}`
        return `"${text.replaceAll('"', '""')}"`
      })
      .join(',') + '\r\n'
  )
}
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        timeZone: 'Africa/Nairobi',
        hour12: false,
      })
    : ''

export async function* financeTransactionsCsv(
  church: string,
  rows: AsyncIterable<FinanceEntry>
) {
  yield '\uFEFF' +
    financeCsvRow([
      'Church',
      'Voucher / receipt',
      'Date (Africa/Nairobi)',
      'Direction',
      'Record type',
      'Category / giving type',
      'Amount',
      'Currency',
      'Status',
      'Source',
      'Payment method',
      'Payment reference',
      'Donor / payee',
      'Description',
      'Notes',
      'Campaign',
      'Pledge ID',
      'Invoice number',
      'Invoice date',
      'Due date',
      'Service period from',
      'Service period to',
      'Recorded by',
      'Recorded at (Africa/Nairobi)',
      'Updated at (Africa/Nairobi)',
      'Voided at (Africa/Nairobi)',
      'Change reason',
      'Reconciled at (Africa/Nairobi)',
      'Statement reference',
      'Filed documents',
      'Record ID',
    ])
  for await (const row of rows)
    yield financeCsvRow([
      church,
      row.voucher_number,
      time(row.occurred_at),
      row.direction,
      row.kind,
      financeCategory(row),
      Number(row.amount),
      row.currency,
      row.status,
      SOURCE_LABELS[row.source] ?? row.source,
      financePaymentLabel(row),
      row.reference,
      row.payee,
      row.description,
      row.notes,
      row.campaign_name,
      row.pledge_id,
      row.invoice_number,
      row.invoice_date,
      row.due_date,
      row.period_start,
      row.period_end,
      row.recorded_by_name,
      time(row.created_at),
      time(row.updated_at),
      time(row.voided_at),
      row.change_reason,
      time(row.reconciled_at),
      row.reconciliation_reference,
      String(row.document_count),
      row.id,
    ])
}
export function financeSummaryCsv(
  church: string,
  period: FinancePeriod,
  summary: FinanceSummary
) {
  const rows: unknown[][] = [
    ['Church', church],
    ['Period (inclusive, Africa/Nairobi)', `${period.from} to ${period.to}`],
    ['Currency', period.currency],
    [
      'Accounting basis',
      'Cash received and paid; unpaid bills, test, pending, failed and voided records are excluded from cash totals.',
    ],
    [
      'Balance basis',
      'Balances reflect only records held in this system, not a verified bank balance.',
    ],
    [],
    ['Metric', 'Amount'],
    ['Recorded opening balance', summary.openingBalance],
    ['Income', summary.totalIncome],
    ['Expenses paid', summary.totalExpense],
    ['Net movement', summary.netBalance],
    ['Recorded closing balance', summary.closingBalance],
    ['Outstanding bills at period end', summary.outstandingBills],
    ['Overdue bills at period end', summary.overdueBills],
    [],
    ['Income category', 'Amount'],
    ...summary.byType.map((r) => [
      r.kind === 'giving' ? givingLabel(r.type) : r.type,
      r.total,
    ]),
    [],
    ['Expense category', 'Amount'],
    ...summary.byCategory.map((r) => [r.name, r.total]),
    [],
    ['Payment method', 'Income', 'Expense'],
    ...summary.byMethod.map((r) => [
      PAYMENT_LABELS[r.method] ?? r.method,
      r.income,
      r.expense,
    ]),
    [],
    ['Month (Africa/Nairobi)', 'Income', 'Expense'],
    ...summary.monthly.map((r) => [r.month, r.income, r.expense]),
    [],
    ['Check', 'Count'],
    ['Completed records', String(summary.completedCount)],
    ['Automatic records', String(summary.automaticCount)],
    ['Manual records', String(summary.manualCount)],
    ['Unreconciled records', String(summary.unreconciledCount)],
    [
      'Paid expenses without supporting documents',
      String(summary.missingDocumentsCount),
    ],
    ['Excluded records', String(summary.excludedCount)],
  ]
  return '\uFEFF' + rows.map(financeCsvRow).join('')
}
export async function* financeAuditCsv(rows: AsyncIterable<FinanceAudit>) {
  yield '\uFEFF' +
    financeCsvRow([
      'Changed at (Africa/Nairobi)',
      'Record type',
      'Record ID',
      'Action',
      'Changed by',
      'Reason',
      'Before',
      'After',
      'History ID',
    ])
  for await (const row of rows)
    yield financeCsvRow([
      time(row.created_at),
      row.entity_type,
      row.entity_id,
      row.action,
      row.actor_name,
      row.reason,
      row.before_data ? JSON.stringify(row.before_data) : '',
      row.after_data ? JSON.stringify(row.after_data) : '',
      row.id,
    ])
}
