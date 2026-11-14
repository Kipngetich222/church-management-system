import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as renderer from '@react-pdf/renderer'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))

function fixture() {
  const loaded = new Map()
  let f,
    currentUser = '00000000-0000-4000-8000-000000000001'
  const mocks = {
    '@react-pdf/renderer': renderer,
    '@/lib/supabase/admin': { createAdminClient: () => f.db },
    '@/lib/supabase/server': {
      createClient: async () => ({
        from: f.db.from.bind(f.db),
        auth: {
          getUser: async () => ({
            data: { user: currentUser ? { id: currentUser } : null },
          }),
        },
      }),
    },
    'next/navigation': {
      useRouter: () => ({ refresh() {}, push() {}, back() {} }),
    },
  }
  function load(relative) {
    let filename = path.isAbsolute(relative)
      ? relative
      : path.resolve(root, relative)
    if (!/\.(tsx?|js)$/.test(filename))
      filename += existsSync(`${filename}.ts`) ? '.ts' : '.tsx'
    if (loaded.has(filename)) return loaded.get(filename).exports
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText
    const mod = { exports: {} }
    loaded.set(filename, mod)
    const localRequire = (name) => {
      if (name in mocks) return mocks[name]
      if (name.startsWith('@/'))
        return load(path.join(root, 'web/src', name.slice(2)))
      if (name.startsWith('.'))
        return load(path.resolve(path.dirname(filename), name))
      return require(name)
    }
    new Function('require', 'module', 'exports', compiled)(
      localRequire,
      mod,
      mod.exports
    )
    return mod.exports
  }
  const helpers = load('test/helpers/finance-fixture.ts')
  f = helpers.financeFixture()
  load('web/src/lib/services/finance.service.ts').financeEngine = () => f.engine
  return {
    ...f,
    ...helpers,
    load,
    mock: (name, value) => {
      mocks[name] = value
    },
    signIn: (user) => {
      currentUser = user
    },
  }
}
function request(
  url,
  body,
  method = 'GET',
  origin = 'https://church.example.test'
) {
  return new Request(`https://church.example.test${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    ...(method === 'GET'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
}
const entryInput = (f) => ({
  churchId: f.financeChurch,
  kind: 'expense',
  requestId: f.financeId(45000),
  amount: 123.45,
  currency: 'KES',
  categoryId: f.financeId(7000),
  description: 'Electricity for January',
  payee: 'Power supplier',
  method: 'bank_transfer',
  reference: 'BANK-JAN-1',
  spentAt: '2025-01-15T12:00:00Z',
  invoiceNumber: 'BILL-JAN',
  invoiceDate: '2025-01-10',
  dueDate: '2025-01-30',
  periodStart: '2025-01-01',
  periodEnd: '2025-01-31',
  notes: 'Approved for payment',
})

test('finance web routes authorize every read, download and write before accessing records', async () => {
  const f = fixture(),
    query = `?churchId=${f.financeChurch}`
  const history = f.load('web/src/app/api/finance/transactions/route.ts').GET
  const report = f.load('web/src/app/api/finance/report/route.tsx').GET
  const create = f.load('web/src/app/api/finance/entries/route.ts').POST
  for (const [user, status] of [
    [null, 401],
    [f.financeId(2), 403],
    [f.financeId(4), 403],
    [f.financeId(5), 403],
  ]) {
    f.signIn(user)
    assert.equal(
      (await history(request(`/api/finance/transactions${query}`))).status,
      status
    )
    assert.equal(
      (
        await report(
          request(`/api/finance/report${query}&format=csv&report=transactions`)
        )
      ).status,
      status
    )
    assert.equal(
      (await create(request('/api/finance/entries', entryInput(f), 'POST')))
        .status,
      status
    )
  }
  assert.equal(f.rpcCalls.length, 0)
  assert.ok(
    f.dbRequests.every((r) =>
      /\/(church_memberships|role_permissions)$/.test(r.url.pathname)
    )
  )
  f.tables.role_permissions.find((r) => r.role === 'dept_admin').permissions = [
    'finance:read',
  ]
  f.signIn(f.financeId(6))
  assert.equal(
    (await history(request(`/api/finance/transactions${query}`))).status,
    200
  )
  assert.equal(
    (await create(request('/api/finance/entries', entryInput(f), 'POST')))
      .status,
    403
  )
})

test('finance web input validation rejects invalid dates, amounts, JSON and cross-origin writes', async () => {
  const f = fixture(),
    create = f.load('web/src/app/api/finance/entries/route.ts').POST
  for (const input of [
    '{broken',
    [],
    { ...entryInput(f), amount: -10 },
    { ...entryInput(f), amount: 0.001 },
    { ...entryInput(f), periodEnd: '2024-12-31' },
    { ...entryInput(f), invoiceDate: '2025-02-29' },
  ]) {
    const response = await create(
      request('/api/finance/entries', input, 'POST')
    )
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  assert.equal(
    (
      await create(
        request(
          '/api/finance/entries',
          entryInput(f),
          'POST',
          'https://elsewhere.test'
        )
      )
    ).status,
    403
  )
  const report = f.load('web/src/app/api/finance/report/route.tsx').GET
  for (const query of [
    'from=2025-02-29',
    'from=2025-02-01&to=2025-01-01',
    'format=exe',
    'report=unknown',
    'report=audit&format=csv&entityType=expense&entityId=invalid',
    'pageSize=1000',
    'documents=unknown',
  ]) {
    assert.equal(
      (
        await report(
          request(`/api/finance/report?churchId=${f.financeChurch}&${query}`)
        )
      ).status,
      400
    )
  }
  assert.equal(f.tables.expenses.length, 0)
})

test('manual expense filing retains invoice, supplier and salary/service dates and retries only once', async () => {
  const f = fixture(),
    create = f.load('web/src/app/api/finance/entries/route.ts').POST
  const first = await create(
    request('/api/finance/entries', entryInput(f), 'POST')
  )
  assert.equal(first.status, 200)
  const saved = await first.json()
  assert.equal(
    (
      await (
        await create(request('/api/finance/entries', entryInput(f), 'POST'))
      ).json()
    ).id,
    saved.id
  )
  assert.equal(f.tables.expenses.length, 1)
  assert.equal(f.tables.expenses[0].invoice_number, 'BILL-JAN')
  assert.equal(f.tables.expenses[0].period_end, '2025-01-31')
  assert.equal(f.tables.expenses[0].recorded_by, f.financeAdmin)
  assert.equal(f.tables.expenses[0].source, 'manual')
  assert.equal(
    (
      await create(
        request(
          '/api/finance/entries',
          { ...entryInput(f), amount: 500 },
          'POST'
        )
      )
    ).status,
    409
  )
  const bill = await create(
    request(
      '/api/finance/entries',
      { ...entryInput(f), requestId: f.financeId(45001), status: 'unpaid' },
      'POST'
    )
  )
  assert.equal(bill.status, 200)
  assert.equal(f.tables.expenses[1].spent_at, null)
})

test('bill payments and corrections require the current version and a reason', async () => {
  const f = fixture(),
    row = { ...f.financeRow(), status: 'unpaid' }
  f.tables.expenses.push(row)
  const { PATCH } = f.load(
    'web/src/app/api/finance/entries/[kind]/[id]/route.ts'
  )
  const context = { params: Promise.resolve({ kind: 'expense', id: row.id }) }
  const url = `/api/finance/entries/expense/${row.id}?churchId=${f.financeChurch}`
  const input = {
    action: 'pay',
    reason: 'Matched supplier invoice',
    expectedUpdatedAt: row.updated_at,
    spentAt: '2025-02-01T12:00:00Z',
    method: 'mpesa',
    reference: 'SMS1234567',
  }
  assert.equal(
    (await PATCH(request(url, { ...input, reason: '' }, 'PATCH'), context))
      .status,
    400
  )
  assert.equal(
    (
      await PATCH(
        request(url, { ...input, expectedUpdatedAt: 'stale' }, 'PATCH'),
        context
      )
    ).status,
    409
  )
  assert.equal((await PATCH(request(url, input, 'PATCH'), context)).status, 200)
  assert.equal(f.tables.expenses[0].status, 'paid')
  assert.equal(f.tables.expenses[0].reference, 'SMS1234567')
})

test('document filters include uploaded and legacy receipts across history and every CSV page', async () => {
  const f = fixture()
  f.tables.finance_register.push(
    ...Array.from({ length: 1107 }, (_, n) =>
      f.financeRow(n, n % 2
        ? { document_count: 1 }
        : { legacy_receipt_url: `https://files.example.test/receipt-${n}.pdf` })
    ),
    f.financeRow(9000, { church_id: f.financeId(200), document_count: 1 }),
    f.financeRow(9001, { currency: 'USD', document_count: 1 }),
    f.financeRow(9002)
  )
  f.tables.finance_register[0].payee = '=HYPERLINK("unsafe")'
  const history = f.load('web/src/app/api/finance/transactions/route.ts').GET
  const filed = await history(request(
    `/api/finance/transactions?churchId=${f.financeChurch}&currency=KES&documents=attached&pageSize=25`
  ))
  assert.equal(filed.status, 200)
  const page = await filed.json()
  assert.equal(page.total, 1107)
  assert.equal(page.rows.length, 25)
  const missing = await history(request(
    `/api/finance/transactions?churchId=${f.financeChurch}&currency=KES&documents=missing`
  ))
  assert.equal(missing.status, 200)
  assert.deepEqual((await missing.json()).rows.map((r) => r.id), [f.financeRow(9002).id])
  const { GET } = f.load('web/src/app/api/finance/report/route.tsx')
  const response = await GET(
    request(
      `/api/finance/report?churchId=${f.financeChurch}&report=transactions&format=csv&from=2025-01-01&to=2025-01-31&currency=KES&documents=attached&page=2`
    )
  )
  assert.equal(response.status, 200)
  assert.match(
    response.headers.get('content-disposition'),
    /attachment;.*\.csv/
  )
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const csv = await response.text()
  assert.equal(csv.split('\r\n').filter(Boolean).length, 1108)
  assert.match(csv, /EXP-1106/)
  assert.doesNotMatch(csv, /EXP-900[012]/)
  assert.match(csv, /Service period from/)
  assert.match(csv, /'\=HYPERLINK/)
  assert.match(csv, /INV-0/)
  assert.match(csv, /"12\.35"/)
})

test('summary CSV uses the full database aggregate with inclusive Nairobi dates', async () => {
  const f = fixture(),
    { GET } = f.load('web/src/app/api/finance/report/route.tsx')
  const response = await GET(
    request(
      `/api/finance/report?churchId=${f.financeChurch}&format=csv&from=2025-01-01&to=2025-01-31`
    )
  )
  assert.equal(response.status, 200)
  const csv = await response.text()
  assert.match(csv, /Grace Church/)
  assert.match(csv, /2025-01-01 to 2025-01-31/)
  assert.match(csv, /"Recorded opening balance","200\.00"/)
  assert.match(csv, /"Income","100\.30"/)
  assert.match(csv, /Outstanding bills at period end/)
  assert.deepEqual(f.rpcCalls[0], {
    name: 'finance_summary',
    args: {
      p_church: f.financeChurch,
      p_from: '2024-12-31T21:00:00.000Z',
      p_to: '2025-01-31T21:00:00.000Z',
      p_currency: 'KES',
    },
  })
})

test('real PDF downloads render summary, a multi-page register and an individual expense voucher', async () => {
  const f = fixture()
  f.tables.finance_register.push(
    ...Array.from({ length: 100 }, (_, n) => f.financeRow(n))
  )
  const report = f.load('web/src/app/api/finance/report/route.tsx').GET
  for (const kind of ['summary', 'transactions']) {
    const response = await report(
      request(
        `/api/finance/report?churchId=${f.financeChurch}&format=pdf&report=${kind}&from=2025-01-01&to=2025-01-31`
      )
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/pdf')
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF')
    assert.ok(bytes.length > 1500)
    if (kind === 'transactions')
      assert.ok(
        (bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1
      )
  }
  const row = f.tables.finance_register[0]
  const voucher = f.load(
    'web/src/app/api/finance/entries/[kind]/[id]/voucher/route.tsx'
  ).GET
  const context = { params: Promise.resolve({ kind: 'expense', id: row.id }) }
  const response = await voucher(
    request(
      `/api/finance/entries/expense/${row.id}/voucher?churchId=${f.financeChurch}`
    ),
    context
  )
  assert.equal(response.status, 200)
  assert.match(
    response.headers.get('content-disposition'),
    new RegExp(`finance-record-${row.id}\\.pdf`)
  )
  assert.equal(
    Buffer.from(await response.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    '%PDF'
  )
  f.signIn(f.financeId(2))
  assert.equal(
    (
      await voucher(
        request(
          `/api/finance/entries/expense/${row.id}/voucher?churchId=${f.financeChurch}`
        ),
        context
      )
    ).status,
    403
  )
})

test('supporting files stay private and downloads verify both church and finance permission', async () => {
  const f = fixture(),
    row = f.financeRow()
  f.tables.expenses.push(row)
  const upload = f.load('web/src/app/api/finance/documents/route.ts').POST
  const makeUpload = (text = '%PDF-1.7 invoice') => {
    const body = new FormData()
    body.set('churchId', f.financeChurch)
    body.set('kind', 'expense')
    body.set('id', row.id)
    body.set(
      'file',
      new File([text], 'Electricity invoice.pdf', { type: 'application/pdf' })
    )
    return new Request('https://church.example.test/api/finance/documents', {
      method: 'POST',
      headers: { Origin: 'https://church.example.test' },
      body,
    })
  }
  assert.equal((await upload(makeUpload('<html>spoof</html>'))).status, 400)
  const saved = await (await upload(makeUpload())).json()
  const download = f.load('web/src/app/api/finance/documents/[id]/route.ts').GET
  const context = { params: Promise.resolve({ id: saved.id }) }
  f.signIn(f.financeId(2))
  assert.equal(
    (
      await download(
        request(
          `/api/finance/documents/${saved.id}?churchId=${f.financeChurch}`
        ),
        context
      )
    ).status,
    403
  )
  assert.equal(f.signed.length, 0)
  f.signIn(f.financeAdmin)
  const response = await download(
    request(`/api/finance/documents/${saved.id}?churchId=${f.financeChurch}`),
    context
  )
  assert.equal(response.status, 302)
  assert.match(response.headers.get('location'), /token=short-lived/)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  f.tables.finance_documents[0].church_id = f.financeId(200)
  assert.equal(
    (
      await download(
        request(
          `/api/finance/documents/${saved.id}?churchId=${f.financeChurch}`
        ),
        context
      )
    ).status,
    404
  )
})

test('audit CSV includes complete before and after snapshots beyond the page limit', async () => {
  const f = fixture()
  f.tables.finance_audit.push(
    ...Array.from({ length: 1006 }, (_, n) => ({
      id: f.financeId(50000 + n),
      church_id: f.financeChurch,
      entity_id: f.financeId(20001),
      entity_type: 'expense',
      action: 'updated',
      actor_name: 'Treasurer',
      reason: 'Matched invoice',
      before_data: { notes: 'Old filing' },
      after_data: { notes: 'New filing' },
      created_at: '2025-01-15T12:00:00.000Z',
    }))
  )
  const { GET } = f.load('web/src/app/api/finance/report/route.tsx')
  const response = await GET(
    request(
      `/api/finance/report?churchId=${f.financeChurch}&report=audit&format=csv&entityType=expense&entityId=${f.financeId(20001)}`
    )
  )
  assert.equal(response.status, 200)
  const csv = await response.text()
  assert.equal(csv.split('\r\n').filter(Boolean).length, 1007)
  assert.match(csv, /Old filing/)
  assert.match(csv, /New filing/)
})

test('a failed export page fails the download instead of silently returning a partial CSV', async () => {
  const f = fixture(),
    { financeCsvResponse } = f.load('web/src/lib/finance-stream.ts')
  async function* rows() {
    yield 'Header\r\n'
    throw new Error('Database unavailable on the next page')
  }
  const response = financeCsvResponse(rows(), 'finance.csv')
  await assert.rejects(response.text(), /Database unavailable/)
})

test('finance entry forms expose all giving types and expense filing fields', () => {
  const f = fixture(),
    { FinanceEntryForm } = f.load(
      'web/src/components/finance/FinanceEntryForm.tsx'
    )
  const options = {
    categories: f.tables.expense_categories,
    campaigns: [],
    pledges: [],
    members: [],
  }
  const form = (kind) =>
    renderToStaticMarkup(
      React.createElement(FinanceEntryForm, {
        churchId: f.financeChurch,
        kind,
        options,
      })
    )
  const giving = form('giving')
  for (const type of f.load('web/src/lib/giving.ts').GIVING_TYPES)
    assert.match(giving, new RegExp(`value="${type}"`))
  assert.match(giving, /Campaign \/ designated fund/)
  const expense = form('expense')
  for (const name of [
    'invoiceNumber',
    'invoiceDate',
    'dueDate',
    'periodStart',
    'periodEnd',
    'payee',
    'file',
    'notes',
  ]) {
    assert.match(expense, new RegExp(`name="${name}"`))
  }
  assert.match(expense, /Unpaid bill/)
  assert.match(expense, /Add a custom category/)
  assert.match(expense, /East Africa Time/)
  assert.match(form('income'), /Bank interest/)
})

test('transaction pages display unpaid bills accurately and keep filters and page size in pagination', () => {
  const f = fixture(),
    { FinanceRegister } = f.load(
      'web/src/components/finance/FinanceRegister.tsx'
    )
  const html = renderToStaticMarkup(
    React.createElement(FinanceRegister, {
      churchId: f.financeChurch,
      path: '/admin/finance/expenses',
      filters: {
        from: '2025-01-01',
        to: '2025-01-31',
        kind: 'expense',
        documents: 'missing',
        pageSize: 25,
      },
      history: {
        rows: [f.financeRow(1, { status: 'unpaid' })],
        total: 51,
        page: 1,
        pageSize: 25,
      },
    })
  )
  assert.match(html, /Download CSV/)
  assert.match(html, /Download PDF/)
  assert.match(
    html,
    /from=2025-01-01&amp;to=2025-01-31&amp;kind=expense&amp;documents=missing&amp;page=2&amp;pageSize=25/
  )
  assert.match(html, /Unpaid/)
  assert.doesNotMatch(html, />Cash</)
})

test('finance overview links to missing documents and keeps the report currency for unpaid bills', async () => {
  const f = fixture()
  f.mock('@/lib/auth/guard', {
    requirePermission: async () => ({
      churchId: f.financeChurch,
      user: { id: f.financeAdmin },
      role: 'super_admin',
    }),
  })
  const Page = f.load('web/src/app/admin/finance/reports/page.tsx').default
  const html = renderToStaticMarkup(await Page({
    searchParams: Promise.resolve({ from: '2025-01-01', to: '2025-01-31', currency: 'USD' }),
  }))
  assert.match(html, /\/admin\/finance\/expenses\?from=2025-01-01&amp;to=2025-01-31&amp;currency=USD&amp;status=completed&amp;documents=missing/)
  assert.match(html, /\/admin\/finance\/expenses\?status=unpaid&amp;currency=USD/)
  const { FinanceFilters } = f.load('web/src/components/finance/FinanceFilters.tsx')
  const filters = renderToStaticMarkup(React.createElement(FinanceFilters, {
    filters: { documents: 'missing' },
    kind: 'expense',
  }))
  assert.match(filters, /name="documents"/)
  assert.match(filters, /value="missing" selected=""/)
})
