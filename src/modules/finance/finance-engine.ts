import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GIVING_TYPES } from '../giving/giving.types'
import {
  FINANCE_KINDS,
  PAYMENT_METHODS,
  FinanceError,
  financeAmount,
  financeBounds,
  financeChoice,
  financeCurrency,
  financeDate,
  financeId,
  financePeriod,
  financeRecord,
  financeText,
  financeTimestamp,
  financeToday,
  validateFinanceFilters,
  type ExpenseCategory,
  type FinanceAudit,
  type FinanceBudget,
  type FinanceCampaign,
  type FinanceDocument,
  type FinanceEntry,
  type FinanceFilters,
  type FinanceHistory,
  type FinanceKind,
  type FinanceOptions,
  type FinancePledge,
  type FinanceSummary,
} from './finance.types'

type Result<T> = { data: T; error: { code?: string; message: string } | null }
export function financeChecked<T>({ data, error }: Result<T>): T {
  if (!error) return data
  if (
    ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(
      error.code ?? ''
    )
  )
    throw new FinanceError(
      'Finance is unavailable until the latest database migrations are applied.',
      503
    )
  if (error.code === '23514') throw new FinanceError(error.message)
  if (error.code === '23505')
    throw new FinanceError(
      'This record already exists. Refresh before recording it again.',
      409
    )
  if (error.code === '23503')
    throw new FinanceError(
      'A linked record is no longer available. Refresh and try again.'
    )
  if (error.code === '42501')
    throw new FinanceError(
      'Finance permission is required for this action.',
      403
    )
  throw new FinanceError(
    'The finance record could not be saved or loaded. Please try again.',
    503
  )
}
const ENTRY_TABLES: Record<FinanceKind, string> = {
  giving: 'offerings',
  expense: 'expenses',
  income: 'finance_income',
}
const PLAN_TABLES = {
  campaign: 'campaigns',
  pledge: 'pledges',
  budget: 'finance_budgets',
} as const
type PlanKind = keyof typeof PLAN_TABLES
type Member = {
  id: string
  role: string
  status: string | null
  full_name: string | null
  email: string | null
}

/** One finance implementation for the Nest API and the web app. Every public operation authorizes its church scope. */
export class FinanceEngine {
  readonly db: SupabaseClient
  constructor(client: unknown) {
    this.db = client as SupabaseClient
  }

  private async member(userId: string, churchId: string): Promise<Member> {
    financeId(churchId, 'church')
    financeId(userId, 'user')
    const member = financeChecked(
      await this.db
        .from('church_memberships')
        .select('id, role, status, full_name, email')
        .eq('church_id', churchId)
        .eq('user_id', userId)
        .maybeSingle()
    ) as Member | null
    if (!member || (member.status ?? 'active') !== 'active')
      throw new FinanceError(
        'An active membership in this church is required.',
        403
      )
    return member
  }
  async authorize(
    userId: string,
    churchId: string,
    permission: 'finance:read' | 'finance:write' = 'finance:read'
  ) {
    const member = await this.member(userId, churchId)
    if (!['super_admin', 'dept_admin'].includes(member.role))
      throw new FinanceError(
        'Finance permission is required for this action.',
        403
      )
    const role = financeChecked(
      await this.db
        .from('role_permissions')
        .select('permissions')
        .eq('church_id', churchId)
        .eq('role', member.role)
        .maybeSingle()
    )
    const permissions: string[] = role?.permissions ?? []
    if (!permissions.includes('finance:*') && !permissions.includes(permission))
      throw new FinanceError(
        'Finance permission is required for this action.',
        403
      )
    return member
  }
  private async collect<T>(
    makeQuery: (
      start: number,
      end: number
    ) => PromiseLike<Result<unknown[] | null>>
  ) {
    const rows: T[] = []
    for (let start = 0; ; start += 500) {
      const batch = (financeChecked(await makeQuery(start, start + 499)) ??
        []) as T[]
      rows.push(...batch)
      if (batch.length < 500) return rows
    }
  }
  private entriesQuery(
    churchId: string,
    filters: FinanceFilters,
    count = false
  ) {
    const bounds = financeBounds(filters.from, filters.to)
    let query = this.db
      .from('finance_register')
      .select('*', count ? { count: 'exact' } : undefined)
      .eq('church_id', churchId)
    if (bounds.fromTime) query = query.gte('occurred_at', bounds.fromTime)
    if (bounds.toTime) query = query.lt('occurred_at', bounds.toTime)
    for (const [field, value] of Object.entries({
      currency: filters.currency,
      kind: filters.kind,
      status: filters.status,
      source: filters.source,
      method: filters.method,
      giving_type: filters.type,
      category_id: filters.categoryId,
      campaign_id: filters.campaignId,
    }))
      if (value) query = query.eq(field, value)
    if (filters.reconciled === 'yes')
      query = query.not('reconciled_at', 'is', null)
    if (filters.reconciled === 'no') query = query.is('reconciled_at', null)
    if (filters.documents === 'missing')
      query = query.eq('document_count', 0).is('legacy_receipt_url', null)
    if (filters.documents === 'attached')
      query = query.or('document_count.gt.0,legacy_receipt_url.not.is.null')
    if (filters.search?.trim()) {
      // A single column filter keeps search text out of PostgREST's expression grammar.
      const literal = filters.search
        .trim()
        .replaceAll('\\', '\\\\')
        .replaceAll('%', '\\%')
        .replaceAll('_', '\\_')
      query = query.ilike('search_text', `%${literal}%`)
    }
    return query
  }
  async history(
    userId: string,
    churchId: string,
    input: FinanceFilters = {}
  ): Promise<FinanceHistory> {
    await this.authorize(userId, churchId)
    const filters = validateFinanceFilters(input),
      page = filters.page!,
      pageSize = filters.pageSize!
    const response = await this.entriesQuery(churchId, filters, true)
      .order('occurred_at', { ascending: false })
      .order('entry_key', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
    const rows = (financeChecked(response) ?? []) as FinanceEntry[]
    return { rows, total: response.count ?? 0, page, pageSize }
  }
  private async *entryRows(
    churchId: string,
    filters: FinanceFilters,
    cutoff: string
  ): AsyncGenerator<FinanceEntry> {
    let cursor: FinanceEntry | undefined
    for (;;) {
      let query = this.entriesQuery(churchId, filters)
        .lte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .order('entry_key', { ascending: false })
        .limit(500)
      if (cursor)
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},entry_key.lt.${cursor.entry_key})`
        )
      const batch = (financeChecked(await query) ?? []) as FinanceEntry[]
      for (const row of batch) yield row
      if (batch.length < 500) return
      cursor = batch[batch.length - 1]
    }
  }
  async prepareExport(
    userId: string,
    churchId: string,
    input: FinanceFilters = {}
  ) {
    await this.authorize(userId, churchId)
    const filters = validateFinanceFilters(input)
    const church = financeChecked(
      await this.db
        .from('churches')
        .select('id, name, address, phone, email, logo_url')
        .eq('id', churchId)
        .single()
    )
    if (!church) throw new FinanceError('Church not found.', 404)
    return {
      church,
      filters,
      rows: this.entryRows(churchId, filters, new Date().toISOString()),
    }
  }
  async summary(
    userId: string,
    churchId: string,
    filters: FinanceFilters = {}
  ) {
    await this.authorize(userId, churchId)
    const period = financePeriod(filters)
    const summary = financeChecked(
      await this.db.rpc('finance_summary', {
        p_church: churchId,
        p_from: period.fromTime,
        p_to: period.toTime,
        p_currency: period.currency,
      })
    ) as FinanceSummary
    if (!summary)
      throw new FinanceError('The financial report could not be loaded.', 503)
    return { period, summary }
  }
  async entry(userId: string, churchId: string, kindInput: string, id: string) {
    await this.authorize(userId, churchId)
    const kind = financeChoice(kindInput, FINANCE_KINDS, 'record type')
    financeId(id)
    const entry = financeChecked(
      await this.db
        .from('finance_register')
        .select('*')
        .eq('church_id', churchId)
        .eq('kind', kind)
        .eq('id', id)
        .maybeSingle()
    ) as FinanceEntry | null
    if (!entry) throw new FinanceError('Finance record not found.', 404)
    const [documents, audit] = await Promise.all([
      this.collect<FinanceDocument>((start, end) =>
        this.db
          .from('finance_documents')
          .select('*')
          .eq('church_id', churchId)
          .eq('entity_type', kind)
          .eq('entity_id', id)
          .order('created_at')
          .order('id')
          .range(start, end)
      ),
      this.audit(userId, churchId, {}, { kind, id }),
    ])
    return { entry, documents, audit }
  }
  private async rawEntry(churchId: string, kind: FinanceKind, id: string) {
    financeId(id)
    const row = financeChecked(
      await this.db
        .from(ENTRY_TABLES[kind])
        .select('*')
        .eq('church_id', churchId)
        .eq('id', id)
        .maybeSingle()
    )
    if (!row) throw new FinanceError('Finance record not found.', 404)
    return row as Record<string, any>
  }
  private async insertOnce(
    table: string,
    row: Record<string, unknown>,
    defaultedFields: readonly string[] = []
  ) {
    const result = await this.db.from(table).insert(row).select('*').single()
    // A budget's overlap trigger can run before the unique request-id check.
    if (
      ['23505', '23514'].includes(result.error?.code ?? '') &&
      row.request_id
    ) {
      const previous = financeChecked(
        await this.db
          .from(table)
          .select('*')
          .eq('church_id', row.church_id)
          .eq('request_id', row.request_id)
          .maybeSingle()
      )
      if (previous) {
        const numeric = new Set(['amount', 'goal_amount', 'amount_pledged'])
        const same = Object.entries(row).every(([key, value]) => {
          // Generated dates may advance between attempts; explicit dates must match.
          if (value === undefined || defaultedFields.includes(key)) return true
          if (numeric.has(key)) return Number(previous[key]) === Number(value)
          if (key.endsWith('_at') && value && previous[key])
            return (
              Date.parse(String(previous[key])) === Date.parse(String(value))
            )
          return (previous[key] ?? null) === value
        })
        if (!same)
          throw new FinanceError(
            'This submission was already saved with different details. Open the saved record before entering a new one.',
            409
          )
        return previous as { id: string }
      }
    }
    return financeChecked(result) as { id: string }
  }
  private async submissionDate(
    table: 'expenses' | 'pledges',
    row: Record<string, unknown>,
    field: 'invoice_date' | 'starts_on'
  ) {
    // Reuse a saved default before checking due/end dates: a retry can arrive
    // after midnight, when today's date would make the original range invalid.
    const previous = financeChecked(
      await this.db
        .from(table)
        .select(field)
        .eq('church_id', row.church_id)
        .eq('request_id', row.request_id)
        .maybeSingle()
    ) as Record<string, unknown> | null
    return previous?.[field] ?? financeToday()
  }
  private async rejectCapturedPayment(
    churchId: string,
    direction: 'income' | 'expense',
    row: Record<string, unknown>
  ) {
    if (row.method !== 'mpesa' || !row.reference) return
    const reference = String(row.reference)
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')
    const previous = financeChecked(
      await this.db
        .from('finance_register')
        .select('id, voucher_number')
        .eq('church_id', churchId)
        .eq('direction', direction)
        .eq('status', 'completed')
        .neq('source', 'manual')
        .eq('currency', row.currency)
        .eq('amount', row.amount)
        .ilike('reference', reference)
        .limit(1)
        .maybeSingle()
    )
    if (previous)
      throw new FinanceError(
        `This payment is already captured automatically as ${previous.voucher_number || previous.id}. Search its reference in Finance transactions before entering it again.`,
        409
      )
  }
  async createEntry(
    userId: string,
    churchId: string,
    kindInput: string,
    value: unknown
  ) {
    await this.authorize(userId, churchId, 'finance:write')
    const kind = financeChoice(kindInput, FINANCE_KINDS, 'record type'),
      input = financeRecord(value)
    const defaultedFields: string[] = []
    const row: Record<string, unknown> = {
      church_id: churchId,
      request_id: financeId(input.requestId, 'submission'),
      amount: financeAmount(input.amount),
      currency: financeCurrency(input.currency ?? 'KES'),
      method: financeChoice(
        input.method ?? 'cash',
        PAYMENT_METHODS,
        'payment method'
      ),
      reference: financeText(input.reference, 'Payment reference', 120),
      notes: financeText(input.notes, 'Notes', 4000),
      recorded_by: userId,
    }
    if (kind === 'giving') {
      row.type = financeChoice(
        input.type ?? 'general',
        GIVING_TYPES,
        'giving type'
      )
      row.membership_id = financeId(input.membershipId, 'member', true)
      row.campaign_id = financeId(input.campaignId, 'campaign', true)
      row.pledge_id = financeId(input.pledgeId, 'pledge', true)
      row.donor_name = financeText(input.donorName, 'Donor name', 200)
      row.given_at = financeTimestamp(input.givenAt ?? new Date().toISOString())
      if (input.givenAt == null) defaultedFields.push('given_at')
      row.status = 'completed'
    } else if (kind === 'expense') {
      row.description = financeText(input.description, 'Description', 500, true)
      row.payee = financeText(input.payee, 'Payee or supplier', 200, true)
      row.category_id = financeId(input.categoryId, 'expense category', true)
      if (!row.category_id && input.categoryName)
        row.category_id = (
          await this.createCategory(userId, churchId, {
            name: input.categoryName,
          })
        ).id
      if (!row.category_id)
        throw new FinanceError('Select an expense category or add a new one.')
      row.status = financeChoice(
        input.status ?? 'paid',
        ['paid', 'unpaid'],
        'expense status'
      )
      row.invoice_number = financeText(
        input.invoiceNumber,
        'Invoice number',
        120
      )
      row.invoice_date = financeDate(
        input.invoiceDate ??
          (await this.submissionDate('expenses', row, 'invoice_date')),
        'Invoice date'
      )
      if (input.invoiceDate == null) defaultedFields.push('invoice_date')
      row.due_date = input.dueDate
        ? financeDate(input.dueDate, 'Due date')
        : null
      row.period_start = input.periodStart
        ? financeDate(input.periodStart, 'Service period start')
        : null
      row.period_end = input.periodEnd
        ? financeDate(input.periodEnd, 'Service period end')
        : null
      if (row.due_date && String(row.due_date) < String(row.invoice_date))
        throw new FinanceError('Due date cannot be before the invoice date.')
      if (
        row.period_end &&
        (!row.period_start || String(row.period_end) < String(row.period_start))
      )
        throw new FinanceError('Choose a valid service period.')
      row.spent_at =
        row.status === 'paid'
          ? financeTimestamp(input.spentAt ?? new Date().toISOString())
          : null
      if (row.status === 'paid' && input.spentAt == null)
        defaultedFields.push('spent_at')
      row.source = 'manual'
    } else {
      row.category = financeText(input.category, 'Income category', 120, true)
      row.description = financeText(input.description, 'Description', 500, true)
      row.payee = financeText(input.payee, 'Received from', 200)
      row.received_at = financeTimestamp(
        input.receivedAt ?? new Date().toISOString()
      )
      if (input.receivedAt == null) defaultedFields.push('received_at')
      row.source = 'manual'
      row.status = 'completed'
    }
    if (row.status !== 'unpaid')
      await this.rejectCapturedPayment(
        churchId,
        kind === 'expense' ? 'expense' : 'income',
        row
      )
    return this.insertOnce(ENTRY_TABLES[kind], row, defaultedFields)
  }
  async changeEntry(
    userId: string,
    churchId: string,
    kindInput: string,
    id: string,
    value: unknown
  ) {
    await this.authorize(userId, churchId, 'finance:write')
    const kind = financeChoice(kindInput, FINANCE_KINDS, 'record type'),
      input = financeRecord(value)
    const action = financeChoice(
      input.action,
      ['void', 'pay', 'reconcile', 'unreconcile', 'notes'],
      'action'
    )
    const reason = financeText(
      input.reason,
      'Reason for this change',
      1000,
      true
    )
    const expected = financeText(
      input.expectedUpdatedAt,
      'Record version',
      60,
      true
    )!
    const row = await this.rawEntry(churchId, kind, id)
    if (
      row.status === 'voided' &&
      action === 'void' &&
      row.change_reason === reason
    )
      return { id }
    if (row.updated_at !== expected)
      throw new FinanceError(
        'This record has changed. Refresh it before saving.',
        409
      )
    if (row.status === 'voided')
      throw new FinanceError('A voided record cannot be changed.')
    const patch: Record<string, unknown> = {
      change_reason: reason,
      updated_by: userId,
    }
    const system =
      kind === 'giving' ? !!row.payment_id : row.source !== 'manual'
    if (action === 'void') {
      if (system)
        throw new FinanceError(
          'System payments must stay in the record. Record an actual refund or adjustment separately.'
        )
      patch.status = 'voided'
    } else if (action === 'pay') {
      if (kind !== 'expense' || row.status !== 'unpaid')
        throw new FinanceError('Only an unpaid bill can be marked paid.')
      patch.status = 'paid'
      patch.spent_at = financeTimestamp(input.spentAt)
      patch.method = financeChoice(
        input.method,
        PAYMENT_METHODS,
        'payment method'
      )
      patch.reference = financeText(input.reference, 'Payment reference', 120)
      await this.rejectCapturedPayment(churchId, 'expense', {
        ...row,
        ...patch,
      })
    } else if (action === 'reconcile' || action === 'unreconcile') {
      if (!['completed', 'paid'].includes(row.status))
        throw new FinanceError(
          'Only received or paid records can be reconciled.'
        )
      patch.reconciled_at =
        action === 'reconcile' ? new Date().toISOString() : null
      patch.reconciliation_reference =
        action === 'reconcile'
          ? financeText(
              input.statementReference,
              'Statement reference',
              200,
              true
            )
          : null
    } else {
      if (system)
        throw new FinanceError(
          'Attach a supporting document to file additional details for a system payment.'
        )
      patch.notes = financeText(input.notes, 'Notes', 4000)
    }
    const saved = financeChecked(
      await this.db
        .from(ENTRY_TABLES[kind])
        .update(patch)
        .eq('church_id', churchId)
        .eq('id', id)
        .eq('updated_at', expected)
        .select('id')
        .maybeSingle()
    )
    if (!saved)
      throw new FinanceError(
        'This record has changed. Refresh it before saving.',
        409
      )
    return saved as { id: string }
  }
  async categories(userId: string, churchId: string) {
    await this.authorize(userId, churchId)
    return this.collect<ExpenseCategory>((a, b) =>
      this.db
        .from('expense_categories')
        .select('*')
        .eq('church_id', churchId)
        .order('name')
        .order('id')
        .range(a, b)
    )
  }
  async createCategory(userId: string, churchId: string, value: unknown) {
    await this.authorize(userId, churchId, 'finance:write')
    const input = financeRecord(value),
      name = financeText(input.name, 'Category name', 120, true)!
    const color = financeText(input.color, 'Category color', 7) ?? '#6366f1'
    if (!/^#[0-9a-f]{6}$/i.test(color))
      throw new FinanceError('Use a six-digit hexadecimal category color.')
    const categories = await this.collect<ExpenseCategory>((a, b) =>
      this.db
        .from('expense_categories')
        .select('*')
        .eq('church_id', churchId)
        .order('id')
        .range(a, b)
    )
    const existing = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    )
    if (existing) return existing
    const result = await this.db
      .from('expense_categories')
      .insert({ church_id: churchId, name, color, created_by: userId })
      .select('*')
      .single()
    if (result.error?.code === '23505')
      return financeChecked(
        await this.db
          .from('expense_categories')
          .select('*')
          .eq('church_id', churchId)
          .eq('name', name)
          .single()
      ) as ExpenseCategory
    return financeChecked(result) as ExpenseCategory
  }
  async campaigns(userId: string, churchId: string) {
    await this.member(userId, churchId)
    return this.collect<FinanceCampaign>((a, b) =>
      this.db
        .from('finance_campaign_progress')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(a, b)
    )
  }
  async pledges(userId: string, churchId: string, mine = false) {
    const member = mine
      ? await this.member(userId, churchId)
      : await this.authorize(userId, churchId)
    return this.collect<FinancePledge>((a, b) => {
      let query = this.db
        .from('finance_pledge_progress')
        .select('*')
        .eq('church_id', churchId)
      if (mine) query = query.eq('membership_id', member.id)
      return query
        .order('created_at', { ascending: false })
        .order('id')
        .range(a, b)
    })
  }
  async budgets(userId: string, churchId: string) {
    await this.authorize(userId, churchId)
    return this.collect<FinanceBudget>((a, b) =>
      this.db
        .from('finance_budget_progress')
        .select('*')
        .eq('church_id', churchId)
        .order('start_date', { ascending: false })
        .order('id')
        .range(a, b)
    )
  }
  async options(userId: string, churchId: string): Promise<FinanceOptions> {
    await this.authorize(userId, churchId, 'finance:write')
    const [categories, campaigns, pledges, members] = await Promise.all([
      this.collect<ExpenseCategory>((a, b) =>
        this.db
          .from('expense_categories')
          .select('*')
          .eq('church_id', churchId)
          .order('name')
          .order('id')
          .range(a, b)
      ),
      this.campaigns(userId, churchId),
      this.collect<FinancePledge>((a, b) =>
        this.db
          .from('finance_pledge_progress')
          .select('*')
          .eq('church_id', churchId)
          .order('id')
          .range(a, b)
      ),
      this.collect<{
        id: string
        full_name: string | null
        email: string | null
        users: { full_name: string | null; email: string | null } | null
      }>((a, b) =>
        this.db
          .from('church_memberships')
          .select(
            'id, full_name, email, users!church_memberships_user_id_fkey(full_name, email)'
          )
          .eq('church_id', churchId)
          .eq('status', 'active')
          .order('id')
          .range(a, b)
      ),
    ])
    return {
      categories,
      campaigns: campaigns.filter((c) => c.status === 'active'),
      pledges: pledges.filter((p) => p.status === 'active'),
      members: members.map((m) => ({
        id: m.id,
        label:
          m.full_name ||
          m.users?.full_name ||
          m.email ||
          m.users?.email ||
          'Member',
      })),
    }
  }
  async createPlan(
    userId: string,
    churchId: string,
    kindInput: string,
    value: unknown
  ) {
    await this.authorize(userId, churchId, 'finance:write')
    const kind = financeChoice(
        kindInput,
        ['campaign', 'pledge', 'budget'] as const,
        'plan type'
      ),
      input = financeRecord(value)
    const row: Record<string, unknown> = {
      church_id: churchId,
      request_id: financeId(input.requestId, 'submission'),
      currency: financeCurrency(input.currency ?? 'KES'),
      created_by: userId,
    }
    if (kind === 'campaign') {
      row.name = financeText(input.name, 'Campaign name', 200, true)
      row.description = financeText(input.description, 'Description', 4000)
      row.goal_amount = financeAmount(input.goalAmount)
      row.start_date = financeDate(input.startDate, 'Start date')
      row.end_date = input.endDate
        ? financeDate(input.endDate, 'End date')
        : null
      if (row.end_date && String(row.end_date) < String(row.start_date))
        throw new FinanceError('End date cannot be before the start date.')
    } else if (kind === 'pledge') {
      row.membership_id = financeId(input.membershipId, 'member')
      row.campaign_id = financeId(input.campaignId, 'campaign', true)
      row.amount_pledged = financeAmount(input.amountPledged)
      row.frequency = financeChoice(
        input.frequency ?? 'one_time',
        ['one_time', 'weekly', 'monthly', 'quarterly', 'annually'],
        'pledge frequency'
      )
      row.starts_on = financeDate(
        input.startsOn ??
          (await this.submissionDate('pledges', row, 'starts_on')),
        'Start date'
      )
      row.ends_on = input.endsOn ? financeDate(input.endsOn, 'End date') : null
      if (row.ends_on && String(row.ends_on) < String(row.starts_on))
        throw new FinanceError('End date cannot be before the start date.')
      row.notes = financeText(input.notes, 'Notes', 4000)
    } else {
      row.category_id = financeId(input.categoryId, 'expense category')
      row.amount = financeAmount(input.amount)
      row.start_date = financeDate(input.startDate, 'Start date')
      row.end_date = financeDate(input.endDate, 'End date')
      if (String(row.end_date) < String(row.start_date))
        throw new FinanceError('End date cannot be before the start date.')
      row.notes = financeText(input.notes, 'Notes', 4000)
    }
    return this.insertOnce(
      PLAN_TABLES[kind],
      row,
      kind === 'pledge' && input.startsOn == null ? ['starts_on'] : []
    )
  }
  async changePlan(
    userId: string,
    churchId: string,
    kindInput: string,
    id: string,
    value: unknown
  ) {
    await this.authorize(userId, churchId, 'finance:write')
    const kind: PlanKind = financeChoice(
        kindInput,
        ['campaign', 'pledge', 'budget'] as const,
        'plan type'
      ),
      input = financeRecord(value)
    financeId(id)
    const reason = financeText(
      input.reason,
      'Reason for this change',
      1000,
      true
    )
    const expected = financeText(
      input.expectedUpdatedAt,
      'Record version',
      60,
      true
    )
    const status = financeChoice(
      input.status,
      kind === 'campaign'
        ? ['active', 'paused', 'completed', 'cancelled']
        : ['cancelled'],
      'status'
    )
    const saved = financeChecked(
      await this.db
        .from(PLAN_TABLES[kind])
        .update({ status, change_reason: reason, updated_by: userId })
        .eq('church_id', churchId)
        .eq('id', id)
        .eq('updated_at', expected)
        .select('id')
        .maybeSingle()
    )
    if (!saved)
      throw new FinanceError(
        'This record changed or is no longer available. Refresh before saving.',
        409
      )
    return saved
  }
  private auditQuery(
    churchId: string,
    filters: FinanceFilters,
    entity?: { kind: string; id: string },
    count = false
  ) {
    const bounds = financeBounds(filters.from, filters.to)
    let query = this.db
      .from('finance_audit')
      .select('*', count ? { count: 'exact' } : undefined)
      .eq('church_id', churchId)
    if (bounds.fromTime) query = query.gte('created_at', bounds.fromTime)
    if (bounds.toTime) query = query.lt('created_at', bounds.toTime)
    if (entity) {
      financeId(entity.id)
      query = query.eq('entity_type', entity.kind).eq('entity_id', entity.id)
    }
    return query
  }
  async audit(
    userId: string,
    churchId: string,
    input: FinanceFilters = {},
    entity?: { kind: string; id: string }
  ) {
    await this.authorize(userId, churchId)
    const filters = validateFinanceFilters(input),
      page = filters.page!,
      pageSize = filters.pageSize!
    const result = await this.auditQuery(churchId, filters, entity, true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
    return {
      rows: (financeChecked(result) ?? []) as FinanceAudit[],
      total: result.count ?? 0,
      page,
      pageSize,
    }
  }
  async prepareAuditExport(
    userId: string,
    churchId: string,
    input: FinanceFilters = {},
    entity?: { kind: string; id: string }
  ) {
    await this.authorize(userId, churchId)
    const filters = validateFinanceFilters(input)
    if (entity) financeId(entity.id)
    return this.auditRows(churchId, filters, new Date().toISOString(), entity)
  }
  private async *auditRows(
    churchId: string,
    filters: FinanceFilters,
    cutoff: string,
    entity?: { kind: string; id: string }
  ): AsyncGenerator<FinanceAudit> {
    let cursor: FinanceAudit | undefined
    for (;;) {
      let query = this.auditQuery(churchId, filters, entity)
        .lte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(500)
      if (cursor)
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        )
      const batch = (financeChecked(await query) ?? []) as FinanceAudit[]
      for (const row of batch) yield row
      if (batch.length < 500) return
      cursor = batch[batch.length - 1]
    }
  }
  async uploadDocument(
    userId: string,
    churchId: string,
    kindInput: string,
    id: string,
    file: { bytes: Uint8Array; name: string; type: string }
  ) {
    const member = await this.authorize(userId, churchId, 'finance:write')
    const kind = financeChoice(kindInput, FINANCE_KINDS, 'record type')
    await this.rawEntry(churchId, kind, id)
    const size = file.bytes.byteLength
    if (size < 1 || size > 10_485_760)
      throw new FinanceError(
        'Upload a PDF, JPEG or PNG file no larger than 10 MB.'
      )
    const signature = Array.from(file.bytes.slice(0, 8))
    const type =
      file.type === 'application/pdf' &&
      signature.slice(0, 5).join(',') === '37,80,68,70,45'
        ? 'pdf'
        : file.type === 'image/png' &&
            signature.join(',') === '137,80,78,71,13,10,26,10'
          ? 'png'
          : file.type === 'image/jpeg' &&
              signature.slice(0, 3).join(',') === '255,216,255'
            ? 'jpg'
            : null
    if (!type)
      throw new FinanceError('The file must be a valid PDF, JPEG or PNG.')
    const name =
      file.name.replace(/[\p{Cc}/\\]/gu, '_').slice(0, 180) ||
      `document.${type}`
    const path = `${churchId}/${kind}/${id}/${randomUUID()}.${type}`
    const upload = await this.db.storage
      .from('finance-documents')
      .upload(path, file.bytes, { contentType: file.type, upsert: false })
    if (upload.error)
      throw new FinanceError(
        'The document could not be uploaded. The finance record is saved; please retry the attachment.',
        503
      )
    const result = await this.db
      .from('finance_documents')
      .insert({
        church_id: churchId,
        entity_type: kind,
        entity_id: id,
        file_path: path,
        file_name: name,
        mime_type: file.type,
        size_bytes: size,
        uploaded_by: userId,
        uploaded_by_name:
          member.full_name || member.email || 'Finance administrator',
      })
      .select('*')
      .single()
    if (result.error) {
      await this.db.storage.from('finance-documents').remove([path])
      financeChecked(result)
    }
    return result.data as FinanceDocument
  }
  async documentUrl(userId: string, churchId: string, id: string) {
    await this.authorize(userId, churchId)
    financeId(id, 'document')
    const doc = financeChecked(
      await this.db
        .from('finance_documents')
        .select('*')
        .eq('church_id', churchId)
        .eq('id', id)
        .maybeSingle()
    ) as FinanceDocument | null
    if (!doc) throw new FinanceError('Document not found.', 404)
    const result = await this.db.storage
      .from('finance-documents')
      .createSignedUrl(doc.file_path, 60, { download: doc.file_name })
    if (result.error || !result.data?.signedUrl)
      throw new FinanceError(
        'The document could not be downloaded. Please try again.',
        503
      )
    return result.data.signedUrl
  }
}
