import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as renderer from '@react-pdf/renderer'
import sharp from 'sharp'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))
const originalFetch = globalThis.fetch
const originalStorage = process.env.NEXT_PUBLIC_SUPABASE_URL
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalStorage === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalStorage
})

function fixture() {
  const loaded = new Map()
  let f,
    currentUser = '00000000-0000-4000-8000-000000000002'
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
    '@/lib/utils/app-url': { appBaseUrl: () => 'https://church.example.test' },
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) },
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
  const helpers = load('test/helpers/giving-fixture.ts')
  f = helpers.givingFixture()
  // Exercise real authentication/error mapping and routes with the shared engine.
  // Only cookies and external HTTP transports are substituted.
  load('web/src/lib/services/giving.service.ts').givingEngine = () => f.engine
  return {
    ...f,
    ...helpers,
    load,
    signIn: (user) => {
      currentUser = user
    },
  }
}
const request = (
  path,
  body,
  method = 'POST',
  origin = 'https://church.example.test'
) =>
  new Request(`https://church.example.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    ...(method === 'GET'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })

test('web STK initiation validates amount/type and authenticates before charging', async () => {
  const f = fixture(),
    { POST } = f.load('web/src/app/api/giving/mpesa/route.ts')
  for (const body of [
    { ...f.givingInput, amount: 1.25 },
    { ...f.givingInput, amount: -1 },
    { ...f.givingInput, type: 'invalid' },
    '{bad-json',
  ])
    assert.equal((await POST(request('/api/giving/mpesa', body))).status, 400)
  f.signIn(null)
  assert.equal(
    (await POST(request('/api/giving/mpesa', f.givingInput))).status,
    401
  )
  f.signIn(f.givingMember)
  assert.equal(
    (
      await POST(
        request(
          '/api/giving/mpesa',
          f.givingInput,
          'POST',
          'https://elsewhere.example.test'
        )
      )
    ).status,
    403
  )
  assert.equal(f.providerRequests.length, 0)
  const response = await POST(request('/api/giving/mpesa', f.givingInput))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal((await response.json()).status, 'pending')
})

test('web callbacks require the private token and use a reachable canonical URL', async () => {
  const f = fixture(),
    start = f.load('web/src/app/api/giving/mpesa/route.ts').POST
  await start(request('/api/giving/mpesa', f.givingInput))
  const callback = f.load('web/src/app/api/giving/callback/route.ts').POST
  assert.equal(
    (await callback(request('/api/giving/callback', f.callback()))).status,
    401
  )
  const push = f.providerRequests.find((entry) => entry.body?.CallBackURL)
  const url = new URL(push.body.CallBackURL)
  assert.equal(url.pathname, '/api/giving/callback')
  const response = await callback(
    request(`${url.pathname}${url.search}`, f.callback())
  )
  assert.equal(response.status, 200)
  assert.equal(f.payment().status, 'succeeded')
  assert.equal(
    f.load('web/src/app/api/giving/mpesa/callback/route.ts').POST,
    callback
  )
})

test('history, exports and receipts enforce member and church scopes', async () => {
  const f = fixture()
  f.tables.offerings.push(
    f.manualGivingRow(1),
    f.manualGivingRow(2, f.givingId(1003))
  )
  const history = f.load('web/src/app/api/giving/history/route.ts').GET
  let response = await history(
    request(`/api/giving/history?churchId=${f.givingChurch}`, null, 'GET')
  )
  assert.equal((await response.json()).rows.length, 1)
  response = await history(
    request(
      `/api/giving/history?churchId=${f.givingChurch}&scope=church`,
      null,
      'GET'
    )
  )
  assert.equal(response.status, 403)
  const receipt = f.load('web/src/app/api/giving/receipts/[id]/route.tsx').GET
  response = await receipt(
    request(`/api/giving/receipts/id?churchId=${f.givingChurch}`, null, 'GET'),
    { params: Promise.resolve({ id: f.givingId(50002) }) }
  )
  assert.equal(response.status, 404)
  f.signIn(f.givingAdmin)
  const download = f.load('web/src/app/api/giving/export/route.ts').GET
  response = await download(
    request(
      `/api/giving/export?churchId=${f.givingChurch}&scope=church`,
      null,
      'GET'
    )
  )
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition'), /attachment.*\.csv/)
  assert.equal((await response.text()).split('\r\n').filter(Boolean).length, 3)
})

test('web finance totals include every completed gift beyond the default row limit', async () => {
  const f = fixture()
  f.tables.offerings.push(
    ...Array.from({ length: 1005 }, (_, n) => f.manualGivingRow(n)),
    { ...f.manualGivingRow(2000), status: 'review', amount: 90000 },
    { ...f.manualGivingRow(2001), status: 'test', amount: 90000 }
  )
  f.tables.expenses = []
  const { getFinanceSummary } = f.load(
    'web/src/lib/services/finance.service.ts'
  )
  const summary = await getFinanceSummary(
    f.givingChurch,
    '2026-01-01',
    '2027-01-01'
  )
  assert.equal(summary.totalIncome, 10050)
})

test('real PDF download contains a church-branded document and unique receipt identity', async () => {
  const f = fixture(),
    offering = f.manualGivingRow(10)
  f.tables.offerings.push(offering)
  const { GET } = f.load('web/src/app/api/giving/receipts/[id]/route.tsx')
  const response = await GET(
    request(
      `/api/giving/receipts/${offering.id}?churchId=${f.givingChurch}`,
      null,
      'GET'
    ),
    { params: Promise.resolve({ id: offering.id }) }
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.match(
    response.headers.get('content-disposition'),
    /giving-receipt-RCP-10\.pdf/
  )
  const buffer = Buffer.from(await response.arrayBuffer())
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF')
  assert.ok(buffer.length > 1500)
  const { ReceiptDocument } = f.load('web/src/lib/pdf/receipt.tsx')
  const tree = ReceiptDocument({ offering, details: offering.receipt_details })
  assert.equal(tree.props.author, 'Grace Church')
  assert.match(tree.props.title, /RCP-10/)
  const text = (node) => {
    if (node == null || typeof node === 'boolean') return ''
    if (typeof node !== 'object') return String(node)
    if (Array.isArray(node)) return node.map(text).join(' ')
    return text(node.props?.children)
  }
  assert.match(text(tree), /Grace Church/)
  assert.match(text(tree), /Donor 10/)
  assert.match(text(tree), /Offering/)
  assert.match(text(tree), /10\.00/)
  const testTree = ReceiptDocument({
    offering: { ...offering, status: 'test' },
    details: offering.receipt_details,
  })
  assert.match(text(testTree), /TEST RECEIPT.*No money was received/)
})

test('pending and failed giving cannot be downloaded as paid receipts', async () => {
  const f = fixture(),
    offering = { ...f.manualGivingRow(1), status: 'review' }
  f.tables.offerings.push(offering)
  const { GET } = f.load('web/src/app/api/giving/receipts/[id]/route.tsx')
  const response = await GET(
    request(
      `/api/giving/receipts/${offering.id}?churchId=${f.givingChurch}`,
      null,
      'GET'
    ),
    { params: Promise.resolve({ id: offering.id }) }
  )
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /only after payment is confirmed/)
})

test('receipt logo conversion supports WebP and rejects external/internal image URLs', async () => {
  const f = fixture(),
    { receiptLogo } = f.load('web/src/lib/pdf/receipt-logo.ts')
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.example.test'
  const webp = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#15803d' },
  })
    .webp()
    .toBuffer()
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options })
    return new Response(webp, { headers: { 'content-type': 'image/webp' } })
  }
  for (const url of [
    'http://127.0.0.1/private',
    'https://elsewhere.example.test/logo.png',
    `https://storage.example.test/storage/v1/object/public/church-assets/${f.givingId(200)}/logo.webp`,
  ])
    assert.equal(await receiptLogo(url, f.givingChurch), undefined)
  assert.equal(requests.length, 0)
  const logo = await receiptLogo(
    `https://storage.example.test/storage/v1/object/public/church-assets/${f.givingChurch}/logo.webp`,
    f.givingChurch
  )
  assert.match(logo, /^data:image\/png;base64,/)
  assert.equal(requests[0].options.redirect, 'error')
  const { ReceiptDocument } = f.load('web/src/lib/pdf/receipt.tsx'),
    offering = f.manualGivingRow(1)
  const pdf = await renderer.renderToBuffer(
    React.createElement(ReceiptDocument, {
      offering,
      details: offering.receipt_details,
      logo,
    })
  )
  assert.match(pdf.toString('latin1'), /\/Subtype \/Image/)
  globalThis.fetch = async () => new Response(null, { status: 404 })
  assert.equal(
    await receiptLogo(
      `https://storage.example.test/storage/v1/object/public/church-assets/${f.givingChurch}/missing.png`,
      f.givingChurch
    ),
    undefined
  )
})

test('member form renders all requested giving categories and receipts only after confirmation', () => {
  const f = fixture(),
    { GivingForm } = f.load('web/src/components/finance/GivingForm.tsx')
  const props = {
    churchId: f.givingChurch,
    churchName: 'Grace Church',
    settings: { ...f.settings, ready: true },
    initialPayment: null,
  }
  const html = renderToStaticMarkup(React.createElement(GivingForm, props))
  for (const label of [
    'Offering',
    'Tithe',
    'Mission',
    'Building fund',
    'Project fund',
    'Thanksgiving',
    'Compassion',
    'Other',
  ])
    assert.ok(html.includes(label))
  assert.ok(html.includes('giving-amount'))
  assert.ok(html.includes('giving-phone'))
  assert.ok(!html.includes('giving-destination-number'))
  const payment = {
    id: f.givingId(999),
    church_id: f.givingChurch,
    amount: 500,
    phone: '254712345678',
    type: 'general',
    status: 'pending',
    environment: 'production',
    error: null,
  }
  const pending = renderToStaticMarkup(
    React.createElement(GivingForm, { ...props, initialPayment: payment })
  )
  assert.ok(pending.includes('Check payment status'))
  assert.ok(!pending.includes('Download receipt'))
  const completed = renderToStaticMarkup(
    React.createElement(GivingForm, {
      ...props,
      initialPayment: {
        ...payment,
        status: 'succeeded',
        offering_id: f.givingId(50001),
      },
    })
  )
  assert.ok(completed.includes('Download receipt'))
})
