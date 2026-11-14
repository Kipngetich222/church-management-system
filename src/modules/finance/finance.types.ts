import { GIVING_TYPES, UUID_PATTERN, givingLabel } from '../giving/giving.types'

export const FINANCE_KINDS = ['giving', 'expense', 'income'] as const
export type FinanceKind = (typeof FINANCE_KINDS)[number]
export const PAYMENT_METHODS = [
  'cash',
  'mpesa',
  'bank_transfer',
  'cheque',
  'card',
  'online',
  'other',
] as const
export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  online: 'Online',
  other: 'Other',
}
export const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual entry',
  giving_payment: 'Online giving',
  sms_purchase: 'SMS purchase',
  event_registration: 'Event payment',
  event_refund: 'Event refund',
}
export const FINANCE_STATUSES = [
  'completed',
  'unpaid',
  'voided',
  'pending',
  'failed',
  'review',
  'test',
] as const
export const MAX_FINANCE_AMOUNT = 9_999_999_999.99
export const FINANCE_TIME_ZONE = 'Africa/Nairobi'

export class FinanceError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = 'FinanceError'
  }
}
export type FinanceFilters = {
  from?: string
  to?: string
  currency?: string
  kind?: string
  status?: string
  source?: string
  method?: string
  type?: string
  categoryId?: string
  campaignId?: string
  reconciled?: string
  documents?: string
  search?: string
  page?: number
  pageSize?: number
}
export type FinancePeriod = {
  from: string
  to: string
  fromTime: string
  toTime: string
  currency: string
}
export type FinanceEntry = {
  entry_key: string
  id: string
  church_id: string
  kind: FinanceKind
  direction: 'income' | 'expense'
  amount: number
  currency: string
  category: string
  category_id: string | null
  giving_type: string | null
  campaign_id: string | null
  campaign_name: string | null
  pledge_id: string | null
  source: string
  source_id: string | null
  status: (typeof FINANCE_STATUSES)[number]
  method: string
  reference: string | null
  voucher_number: string | null
  occurred_at: string
  entry_date: string
  payee: string | null
  description: string
  notes: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  period_start: string | null
  period_end: string | null
  recorded_by: string | null
  recorded_by_name: string
  created_at: string
  updated_at: string
  voided_at: string | null
  change_reason: string | null
  reconciled_at: string | null
  reconciliation_reference: string | null
  document_count: number
  legacy_receipt_url: string | null
}
export type FinanceHistory = {
  rows: FinanceEntry[]
  total: number
  page: number
  pageSize: number
}
export type FinanceSummary = {
  currency: string
  totalIncome: number
  totalExpense: number
  netBalance: number
  openingBalance: number
  closingBalance: number
  completedCount: number
  unreconciledCount: number
  missingDocumentsCount: number
  excludedCount: number
  manualCount: number
  automaticCount: number
  outstandingBills: number
  outstandingBillCount: number
  overdueBills: number
  byType: { type: string; kind: string; total: number; count: number }[]
  byCategory: { name: string; color: string; total: number; count: number }[]
  byMethod: { method: string; income: number; expense: number }[]
  monthly: { month: string; income: number; expense: number }[]
}
export type FinanceAudit = {
  id: string
  church_id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string | null
  actor_name: string
  reason: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  created_at: string
}
export type FinanceDocument = {
  id: string
  church_id: string
  entity_type: FinanceKind
  entity_id: string
  file_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by_name: string
  created_at: string
}
export type ExpenseCategory = {
  id: string
  church_id: string
  name: string
  color: string
}
export type FinanceCampaign = {
  id: string
  name: string
  description: string | null
  goal_amount: number
  currency: string
  raised: number
  start_date: string
  end_date: string | null
  status: string
  updated_at: string
  created_at: string
}
export type FinancePledge = {
  id: string
  membership_id: string | null
  member_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  amount_pledged: number
  received: number
  currency: string
  frequency: string
  starts_on: string
  ends_on: string | null
  status: string
  notes: string | null
  updated_at: string
  created_at: string
}
export type FinanceBudget = {
  id: string
  category_id: string
  category_name: string
  amount: number
  spent: number
  currency: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  updated_at: string
  created_at: string
}
export type FinanceOptions = {
  categories: ExpenseCategory[]
  campaigns: FinanceCampaign[]
  pledges: FinancePledge[]
  members: { id: string; label: string }[]
}

export function financeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new FinanceError('Enter a valid finance record.')
  return value as Record<string, unknown>
}
export function financeText(
  value: unknown,
  name: string,
  max = 500,
  required = false
): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new FinanceError(`${name} is required.`)
    return null
  }
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new FinanceError(
      `${name} must contain ${required ? '1 to' : 'at most'} ${max} characters.`
    )
  return value.trim() || null
}
export function financeId(
  value: unknown,
  name = 'Record',
  optional = false
): string | null {
  if (optional && (value === undefined || value === null || value === ''))
    return null
  if (typeof value !== 'string' || !UUID_PATTERN.test(value))
    throw new FinanceError(`Select a valid ${name.toLowerCase()}.`)
  return value
}
export function financeAmount(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_FINANCE_AMOUNT ||
    Number(value.toFixed(2)) !== value
  )
    throw new FinanceError(
      'Enter a positive amount with at most two decimal places (maximum 9,999,999,999.99).'
    )
  return Math.round(value * 100) / 100
}
export function financeCurrency(value: unknown = 'KES'): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Z]{3}$/.test(value.trim().toUpperCase())
  )
    throw new FinanceError(
      'Enter a three-letter currency code, for example KES.'
    )
  return value.trim().toUpperCase()
}
export function financeChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
  name: string
): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new FinanceError(`Select a valid ${name}.`)
  return value as T
}
export function financeToday(now = new Date()): string {
  // en-CA's field order is not guaranteed across ICU versions.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: FINANCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (name: string) => parts.find((p) => p.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function financeDate(value: unknown, name = 'Date'): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number(value.slice(0, 4)) < 1900 ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new FinanceError(`${name} must be a valid calendar date.`)
  return value
}
export function financeTimestamp(
  value: unknown,
  name = 'Payment date',
  now = new Date()
): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new FinanceError(
      `${name} must include a valid date, time and time zone.`
    )
  financeDate(value.slice(0, 10), name)
  if (Date.parse(value) > now.getTime() + 300_000)
    throw new FinanceError(
      `${name} cannot be in the future. Record an unpaid bill for a future payment.`
    )
  return new Date(value).toISOString()
}
function rangeDate(value: string, name: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return financeDate(value, name)
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new FinanceError(`${name} must be a valid calendar date.`)
  financeDate(value.slice(0, 10), name)
  return financeToday(new Date(value))
}
export function financeBounds(from?: string, to?: string) {
  const start = from ? rangeDate(from, 'From date') : undefined
  const end = to ? rangeDate(to, 'To date') : undefined
  if (start && end && start > end)
    throw new FinanceError('From date must be on or before the to date.')
  return {
    from: start,
    to: end,
    fromTime: start
      ? new Date(`${start}T00:00:00+03:00`).toISOString()
      : undefined,
    toTime: end
      ? new Date(Date.parse(`${end}T00:00:00+03:00`) + 86_400_000).toISOString()
      : undefined,
  }
}
export function financePeriod(
  filters: FinanceFilters = {},
  now = new Date()
): FinancePeriod {
  const today = financeToday(now)
  const bounds = financeBounds(
    filters.from || `${today.slice(0, 4)}-01-01`,
    filters.to || today
  )
  return {
    from: bounds.from!,
    to: bounds.to!,
    fromTime: bounds.fromTime!,
    toTime: bounds.toTime!,
    currency: financeCurrency(filters.currency || 'KES'),
  }
}
export function validateFinanceFilters(
  filters: FinanceFilters = {}
): FinanceFilters {
  const bounds = financeBounds(filters.from, filters.to)
  const page = filters.page ?? 1,
    pageSize = filters.pageSize ?? 50
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1_000_000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw new FinanceError(
      'Select a valid page and a page size between 1 and 100.'
    )
  if (filters.kind) financeChoice(filters.kind, FINANCE_KINDS, 'record type')
  if (filters.status) financeChoice(filters.status, FINANCE_STATUSES, 'status')
  if (filters.source)
    financeChoice(filters.source, Object.keys(SOURCE_LABELS), 'source')
  if (filters.method)
    financeChoice(filters.method, PAYMENT_METHODS, 'payment method')
  if (filters.type) financeChoice(filters.type, GIVING_TYPES, 'giving type')
  if (filters.reconciled)
    financeChoice(filters.reconciled, ['yes', 'no'], 'reconciliation status')
  if (filters.documents)
    financeChoice(filters.documents, ['missing', 'attached'], 'document status')
  financeId(filters.categoryId, 'category', true)
  financeId(filters.campaignId, 'campaign', true)
  financeText(filters.search, 'Search', 120)
  return {
    ...filters,
    from: bounds.from,
    to: bounds.to,
    currency: filters.currency ? financeCurrency(filters.currency) : undefined,
    page,
    pageSize,
  }
}
export function financeCategory(row: Pick<FinanceEntry, 'kind' | 'category'>) {
  return row.kind === 'giving' ? givingLabel(row.category) : row.category
}
export function financePaymentLabel(
  row: Pick<FinanceEntry, 'status' | 'method'>
) {
  return row.status === 'unpaid'
    ? 'Unpaid'
    : PAYMENT_LABELS[row.method] || row.method
}
export function financeMoney(amount: number, currency = 'KES') {
  return `${currency} ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
