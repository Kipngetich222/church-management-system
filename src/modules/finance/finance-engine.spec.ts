import {
  financeFixture,
  financeAdmin,
  financeChurch,
  financeId as id,
  financeRow,
} from '../../../test/helpers/finance-fixture'
import {
  FinanceError,
  financeAmount,
  financeBounds,
  financePeriod,
  validateFinanceFilters,
} from './finance.types'
import { financeAuditCsv, financeTransactionsCsv } from './finance-csv'

const expenseInput = {
  requestId: id(45000),
  amount: 100.25,
  currency: 'KES',
  categoryId: id(7000),
  payee: 'Power supplier',
  description: 'Electricity',
  invoiceNumber: 'JAN-2025',
  invoiceDate: '2025-01-15',
  periodStart: '2025-01-01',
  periodEnd: '2025-01-31',
  spentAt: '2025-01-15T12:00:00.000Z',
  method: 'bank_transfer',
}
describe('Finance engine authorization, validation and exports', () => {
  it.each([2, 3, 4, 5])(
    'denies member %s before finance queries or writes',
    async (n) => {
      const f = financeFixture()
      for (const action of [
        () => f.engine.history(id(n), financeChurch),
        () => f.engine.summary(id(n), financeChurch),
        () =>
          f.engine.createEntry(id(n), financeChurch, 'expense', expenseInput),
        () => f.engine.prepareExport(id(n), financeChurch),
        () => f.engine.documentUrl(id(n), financeChurch, id(90000)),
      ])
        await expect(action()).rejects.toBeInstanceOf(FinanceError)
      expect(
        f.dbRequests.every((r) =>
          ['church_memberships', 'role_permissions'].some((t) =>
            r.url.pathname.endsWith(t)
          )
        )
      ).toBe(true)
      expect(f.rpcCalls).toHaveLength(0)
    }
  )
  it('lets finance readers read but not write, including inactive administrators', async () => {
    const f = financeFixture()
    f.tables.role_permissions.find(
      (r) => r.role === 'dept_admin'
    )!.permissions = ['finance:read']
    await expect(f.engine.history(id(6), financeChurch)).resolves.toMatchObject(
      { total: 0 }
    )
    await expect(
      f.engine.createEntry(id(6), financeChurch, 'expense', expenseInput)
    ).rejects.toMatchObject({ status: 403 })
    await expect(f.engine.history(id(5), financeChurch)).rejects.toMatchObject({
      status: 403,
    })
  })
  it('records complete manual expenses once when retried and rejects a changed retry', async () => {
    const f = financeFixture()
    const one = await f.engine.createEntry(
      financeAdmin,
      financeChurch,
      'expense',
      expenseInput
    )
    const two = await f.engine.createEntry(
      financeAdmin,
      financeChurch,
      'expense',
      expenseInput
    )
    expect(one.id).toBe(two.id)
    expect(f.tables.expenses).toHaveLength(1)
    expect(f.tables.expenses[0]).toMatchObject({
      payee: 'Power supplier',
      invoice_number: 'JAN-2025',
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      amount: 100.25,
      source: 'manual',
      recorded_by: financeAdmin,
      status: 'paid',
    })
    await expect(
      f.engine.createEntry(financeAdmin, financeChurch, 'expense', {
        ...expenseInput,
        amount: 1,
      })
    ).rejects.toMatchObject({ status: 409 })
  })
  it.each([0, -1, NaN, Infinity, 0.001, 10000000000])(
    'rejects invalid amount %s before saving',
    async (amount) => {
      const f = financeFixture()
      await expect(
        f.engine.createEntry(financeAdmin, financeChurch, 'expense', {
          ...expenseInput,
          amount,
        })
      ).rejects.toBeInstanceOf(FinanceError)
      expect(f.tables.expenses).toHaveLength(0)
    }
  )
  it.each([
    ['giving', 'offerings', 'givenAt', 'given_at'],
    ['expense', 'expenses', 'spentAt', 'spent_at'],
    ['income', 'finance_income', 'receivedAt', 'received_at'],
  ] as const)(
    'retains defaulted dates when the same %s submission is retried',
    async (kind, table, dateInput, dateColumn) => {
      jest.useFakeTimers({ now: new Date('2025-01-15T20:59:59Z') })
      try {
        const f = financeFixture()
        const input = {
          ...expenseInput,
          spentAt: undefined,
          invoiceDate: undefined,
          dueDate: '2025-01-15',
          category: 'Grant',
        }
        const first = await f.engine.createEntry(
          financeAdmin,
          financeChurch,
          kind,
          input
        )
        jest.setSystemTime(new Date('2025-01-15T21:00:01Z'))
        const retry = await f.engine.createEntry(
          financeAdmin,
          financeChurch,
          kind,
          input
        )
        expect(retry.id).toBe(first.id)
        expect(f.tables[table]).toHaveLength(1)
        expect(f.tables[table][0][dateColumn]).toBe('2025-01-15T20:59:59.000Z')
        if (kind === 'expense') {
          expect(f.tables[table][0].invoice_date).toBe('2025-01-15')
          await expect(
            f.engine.createEntry(financeAdmin, financeChurch, kind, {
              ...input,
              requestId: id(45004),
            })
          ).rejects.toMatchObject({ status: 400 })
        }
        await expect(
          f.engine.createEntry(financeAdmin, financeChurch, kind, {
            ...input,
            [dateInput]: '2025-01-15T21:00:01Z',
          })
        ).rejects.toMatchObject({ status: 409 })
      } finally {
        jest.useRealTimers()
      }
    }
  )
  it('retains a default pledge start date when retried after midnight in Nairobi', async () => {
    jest.useFakeTimers({ now: new Date('2025-01-15T20:59:59Z') })
    try {
      const f = financeFixture()
      const input = {
        requestId: id(45001),
        membershipId: id(1002),
        amountPledged: 500,
        endsOn: '2025-01-15',
      }
      const first = await f.engine.createPlan(
        financeAdmin,
        financeChurch,
        'pledge',
        input
      )
      jest.setSystemTime(new Date('2025-01-15T21:00:01Z'))
      const retry = await f.engine.createPlan(
        financeAdmin,
        financeChurch,
        'pledge',
        input
      )
      expect(retry.id).toBe(first.id)
      expect(f.tables.pledges).toHaveLength(1)
      expect(f.tables.pledges[0].starts_on).toBe('2025-01-15')
      await expect(
        f.engine.createPlan(financeAdmin, financeChurch, 'pledge', {
          ...input,
          requestId: id(45002),
        })
      ).rejects.toMatchObject({ status: 400 })
    } finally {
      jest.useRealTimers()
    }
  })
  it('recovers a saved budget when overlap validation runs before the duplicate request constraint', async () => {
    const f = financeFixture()
    const input = {
      requestId: id(45002),
      categoryId: id(7000),
      amount: 500,
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    }
    const first = await f.engine.createPlan(
      financeAdmin,
      financeChurch,
      'budget',
      input
    )
    const overlap = {
      code: '23514',
      message: 'An active budget already covers this category and period',
    }
    f.controls.financeSaveError = overlap
    const retry = await f.engine.createPlan(
      financeAdmin,
      financeChurch,
      'budget',
      input
    )
    expect(retry.id).toBe(first.id)
    expect(f.tables.finance_budgets).toHaveLength(1)
    f.controls.financeSaveError = overlap
    await expect(
      f.engine.createPlan(financeAdmin, financeChurch, 'budget', {
        ...input,
        amount: 600,
      })
    ).rejects.toMatchObject({ status: 409 })
    f.controls.financeSaveError = overlap
    await expect(
      f.engine.createPlan(financeAdmin, financeChurch, 'budget', {
        ...input,
        requestId: id(45003),
      })
    ).rejects.toMatchObject({ status: 400, message: overlap.message })
  })
  it('records unpaid bills without a payment date and requires filing details', async () => {
    const f = financeFixture()
    await f.engine.createEntry(financeAdmin, financeChurch, 'expense', {
      ...expenseInput,
      status: 'unpaid',
      dueDate: '2025-01-30',
    })
    expect(f.tables.expenses[0].spent_at).toBeNull()
    await expect(
      f.engine.createEntry(financeAdmin, financeChurch, 'expense', {
        ...expenseInput,
        requestId: id(45001),
        payee: '  ',
      })
    ).rejects.toThrow('Payee')
  })
  it('requires a reason, a current version and a statement reference for reconciliation', async () => {
    const f = financeFixture(),
      row = financeRow()
    f.tables.expenses.push({ ...row, status: 'paid' })
    await expect(
      f.engine.changeEntry(financeAdmin, financeChurch, 'expense', row.id, {
        action: 'void',
        expectedUpdatedAt: row.updated_at,
      })
    ).rejects.toThrow('Reason')
    await expect(
      f.engine.changeEntry(financeAdmin, financeChurch, 'expense', row.id, {
        action: 'void',
        reason: 'Duplicate',
        expectedUpdatedAt: 'old',
      })
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      f.engine.changeEntry(financeAdmin, financeChurch, 'expense', row.id, {
        action: 'reconcile',
        reason: 'Matched',
        expectedUpdatedAt: row.updated_at,
      })
    ).rejects.toThrow('Statement reference')
    await f.engine.changeEntry(financeAdmin, financeChurch, 'expense', row.id, {
      action: 'reconcile',
      reason: 'Matched bank statement',
      expectedUpdatedAt: row.updated_at,
      statementReference: 'JAN-4',
    })
    expect(f.tables.expenses[0].reconciliation_reference).toBe('JAN-4')
  })
  it('refuses manual voids of automatic payments', async () => {
    const f = financeFixture(),
      row = financeRow(1, { source: 'sms_purchase' })
    f.tables.expenses.push({ ...row, status: 'paid' })
    await expect(
      f.engine.changeEntry(financeAdmin, financeChurch, 'expense', row.id, {
        action: 'void',
        reason: 'Remove',
        expectedUpdatedAt: row.updated_at,
      })
    ).rejects.toThrow('System payments')
  })
  it('detects manual re-entry of a captured M-Pesa payment without combining currencies or directions', async () => {
    const f = financeFixture()
    f.tables.finance_register.push(
      financeRow(1, {
        amount: 100.25,
        source: 'sms_purchase',
        method: 'mpesa',
        reference: 'AUTO123456',
      })
    )
    const input = { ...expenseInput, method: 'mpesa', reference: 'auto123456' }
    await expect(
      f.engine.createEntry(financeAdmin, financeChurch, 'expense', input)
    ).rejects.toMatchObject({ status: 409 })
    expect(f.tables.expenses).toHaveLength(0)
    await expect(
      f.engine.createEntry(financeAdmin, financeChurch, 'expense', {
        ...input,
        currency: 'USD',
      })
    ).resolves.toHaveProperty('id')
    await expect(
      f.engine.createEntry(financeAdmin, financeChurch, 'giving', {
        ...input,
        givenAt: input.spentAt,
      })
    ).resolves.toHaveProperty('id')
  })
  it('exports every matching record using stable cursors and protects spreadsheet cells', async () => {
    const f = financeFixture()
    f.tables.finance_register.push(
      ...Array.from({ length: 1207 }, (_, n) => ({
        ...financeRow(n),
        search_text: `Power ${n}`,
      })),
      financeRow(4000, { church_id: id(200) })
    )
    const history = await f.engine.history(financeAdmin, financeChurch, {
      page: 2,
      pageSize: 100,
    })
    expect(history.total).toBe(1207)
    expect(history.rows).toHaveLength(100)
    f.tables.finance_register[0].payee = '=HYPERLINK("bad")'
    const output = await f.engine.prepareExport(financeAdmin, financeChurch, {
      from: '2025-01-01',
      to: '2025-01-31',
    })
    let csv = ''
    for await (const line of financeTransactionsCsv('Grace', output.rows))
      csv += line
    expect(csv.split('\r\n')).toHaveLength(1209)
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain('EXP-1206')
    expect(csv).not.toContain(id(24000))
    expect(csv).toContain('Service period from')
  })
  it('applies date, source, status and literal text filters without changing the query scope', async () => {
    const f = financeFixture()
    f.tables.finance_register.push(
      { ...financeRow(), search_text: 'Invoice 10%_paid,(test)' },
      financeRow(2, { source: 'sms_purchase' })
    )
    const rows = await f.engine.history(financeAdmin, financeChurch, {
      from: '2025-01-15',
      to: '2025-01-15',
      source: 'manual',
      status: 'completed',
      search: '10%_paid,(test)',
    })
    expect(rows.total).toBe(1)
    const query = f.dbRequests.find((r) =>
      r.url.pathname.endsWith('finance_register')
    )!.url.searchParams
    expect(query.get('church_id')).toBe(`eq.${financeChurch}`)
    expect(query.get('or')).toBeNull()
  })
  it('queries summary using exclusive upper dates and an explicit currency', async () => {
    const f = financeFixture()
    await f.engine.summary(financeAdmin, financeChurch, {
      from: '2025-01-01',
      to: '2025-01-31',
      currency: 'usd',
    })
    expect(f.rpcCalls[0]).toEqual({
      name: 'finance_summary',
      args: {
        p_church: financeChurch,
        p_from: '2024-12-31T21:00:00.000Z',
        p_to: '2025-01-31T21:00:00.000Z',
        p_currency: 'USD',
      },
    })
  })
  it('filters missing documents separately from attachments and previously filed receipts', async () => {
    const f = financeFixture()
    f.tables.finance_register.push(
      financeRow(1),
      financeRow(2, { document_count: 1 }),
      financeRow(3, {
        legacy_receipt_url: 'https://files.example.test/receipt.pdf',
      }),
      financeRow(4, { currency: 'USD' }),
      financeRow(5, { status: 'unpaid' }),
      financeRow(6, { church_id: id(200), document_count: 1 })
    )
    const filters = { kind: 'expense', currency: 'KES', status: 'completed' }
    const missing = await f.engine.history(financeAdmin, financeChurch, {
      ...filters,
      documents: 'missing',
    })
    expect(missing.rows.map((r) => r.id)).toEqual([financeRow(1).id])
    const filed = await f.engine.history(financeAdmin, financeChurch, {
      ...filters,
      documents: 'attached',
    })
    expect(filed.rows.map((r) => r.id)).toEqual([
      financeRow(3).id,
      financeRow(2).id,
    ])
    expect(() => validateFinanceFilters({ documents: 'invalid' })).toThrow(
      FinanceError
    )
  })
  it('keeps attached files private, validates content, and checks access again before downloading', async () => {
    const f = financeFixture(),
      row = financeRow()
    f.tables.expenses.push(row)
    const file = {
      bytes: new TextEncoder().encode('%PDF-1.7 sample'),
      type: 'application/pdf',
      name: 'Electricity/\u0000invoice\\\u007f.pdf',
    }
    const doc = await f.engine.uploadDocument(
      financeAdmin,
      financeChurch,
      'expense',
      row.id,
      file
    )
    expect(doc.file_name).toBe('Electricity__invoice__.pdf')
    expect(f.uploaded[0]).toMatch(
      new RegExp(`^${financeChurch}/expense/${row.id}/`)
    )
    await expect(
      f.engine.documentUrl(id(2), financeChurch, doc.id)
    ).rejects.toMatchObject({ status: 403 })
    expect(f.signed).toHaveLength(0)
    expect(
      await f.engine.documentUrl(financeAdmin, financeChurch, doc.id)
    ).toContain('token=short-lived')
    await expect(
      f.engine.uploadDocument(financeAdmin, financeChurch, 'expense', row.id, {
        ...file,
        bytes: new TextEncoder().encode('<html>'),
      })
    ).rejects.toThrow('valid PDF')
    f.controls.financeSaveFailure = true
    await expect(
      f.engine.uploadDocument(
        financeAdmin,
        financeChurch,
        'expense',
        row.id,
        file
      )
    ).rejects.toMatchObject({ status: 503 })
    expect(f.removed).toHaveLength(1)
  })
  it('exports the complete change history with escaped actor names and full before/after records', async () => {
    const f = financeFixture()
    f.tables.finance_audit.push(
      ...Array.from({ length: 1008 }, (_, n) => ({
        id: id(50000 + n),
        church_id: financeChurch,
        entity_id: id(20001),
        entity_type: 'expense',
        action: 'updated',
        actor_name: '@formula',
        reason: 'Invoice checked',
        before_data: { notes: 'Old' },
        after_data: { notes: 'New' },
        created_at: '2025-01-15T12:00:00.000Z',
      }))
    )
    const rows = await f.engine.prepareAuditExport(
      financeAdmin,
      financeChurch,
      {},
      { kind: 'expense', id: id(20001) }
    )
    let output = ''
    for await (const line of financeAuditCsv(rows)) output += line
    expect(output.split('\r\n')).toHaveLength(1010)
    expect(output).toContain("'@formula")
    expect(output).toContain('Old')
    expect(output).toContain('New')
  })
  it('rejects an invalid audit record before opening the export stream', async () => {
    const f = financeFixture()
    await expect(
      f.engine.prepareAuditExport(
        financeAdmin,
        financeChurch,
        {},
        {
          kind: 'expense',
          id: 'invalid',
        }
      )
    ).rejects.toMatchObject({ status: 400 })
    expect(
      f.dbRequests.some((r) => r.url.pathname.endsWith('finance_audit'))
    ).toBe(false)
  })
})
describe('Finance date and decimal validation', () => {
  it('includes leap-day endpoints without browser time-zone assumptions', () => {
    expect(financeBounds('2024-02-29', '2024-02-29')).toMatchObject({
      fromTime: '2024-02-28T21:00:00.000Z',
      toTime: '2024-02-29T21:00:00.000Z',
    })
    expect(() => financeBounds('2025-02-29')).toThrow()
    expect(() => financeBounds('2025-02-02', '2025-02-01')).toThrow()
    expect(financeAmount(0.29)).toBe(0.29)
    expect(financePeriod({}, new Date('2025-12-31T22:00:00Z')).from).toBe(
      '2026-01-01'
    )
    expect(() => validateFinanceFilters({ page: NaN })).toThrow()
  })
})
