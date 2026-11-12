import { createClient } from '@supabase/supabase-js'
import { GivingEngine } from '../../src/modules/giving/giving-engine'
import { DarajaClient } from '../../src/modules/giving/daraja'
import { encryptGivingCredentials } from '../../src/modules/giving/giving-security'
import type {
  GivingInput,
  GivingPayment,
  GivingSettings,
  ReceiptDetails,
} from '../../src/modules/giving/giving.types'

export const givingId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const givingChurch = givingId(100),
  givingMember = givingId(2),
  givingAdmin = givingId(1)
export const givingKey = 'ab'.repeat(32)
export const givingCredentials = {
  consumerKey: 'test-consumer-key',
  consumerSecret: 'test-consumer-secret',
  passkey: 'test-passkey',
}
export const givingInput: GivingInput = {
  churchId: givingChurch,
  requestId: givingId(10000),
  amount: 500,
  phone: '0712345678',
  type: 'general',
}
type Row = Record<string, any>

function splitLogical(value: string): string[] {
  let depth = 0,
    start = 0
  const parts: string[] = []
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    if (value[i] === ')') depth--
    if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts
}
function predicate(row: Row, expression: string): boolean {
  if (expression.startsWith('and('))
    return splitLogical(expression.slice(4, -1)).every((item) =>
      predicate(row, item)
    )
  const match = expression.match(
    /^([^.]+)\.(eq|neq|is|gte|gt|lte|lt|in|not)\.(.*)$/
  )
  if (!match) throw new Error(`Unimplemented test filter: ${expression}`)
  const [, field, operator, value] = match,
    actual = row[field]
  if (operator === 'not') return !predicate(row, `${field}.${value}`)
  if (operator === 'is')
    return value === 'null' ? actual == null : String(actual) === value
  if (operator === 'in')
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.replaceAll('"', ''))
      .includes(String(actual))
  if (operator === 'eq') return String(actual) === value
  if (operator === 'neq') return String(actual) !== value
  if (actual == null) return false
  if (operator === 'gte') return String(actual) >= value
  if (operator === 'gt') return String(actual) > value
  if (operator === 'lte') return String(actual) <= value
  return String(actual) < value
}

/** Real Supabase/Daraja adapters, with only their HTTP transports substituted. */
export function givingFixture() {
  const settings: GivingSettings = {
    church_id: givingChurch,
    enabled: true,
    destination_type: 'paybill',
    destination_number: '123456',
    account_reference: 'CHURCH',
    business_shortcode: '123456',
    environment: 'production',
    credentials_ciphertext: encryptGivingCredentials(
      givingCredentials,
      givingKey
    ),
    updated_at: new Date().toISOString(),
  }
  const tables: Record<string, Row[]> = {
    church_giving_settings: [settings],
    giving_payments: [],
    offerings: [],
    church_memberships: [1, 2, 3, 4, 5, 6].map((n) => ({
      id: givingId(1000 + n),
      user_id: givingId(n),
      church_id: n === 4 ? givingId(200) : givingChurch,
      role:
        n === 1 || n === 4 || n === 5
          ? 'super_admin'
          : n === 6
            ? 'dept_admin'
            : 'member',
      status: n === 5 ? 'inactive' : 'active',
      full_name: `Member ${n}`,
      email: `member${n}@example.test`,
    })),
    role_permissions: [
      {
        church_id: givingChurch,
        role: 'super_admin',
        permissions: ['finance:*'],
      },
      { church_id: givingChurch, role: 'dept_admin', permissions: [] },
    ],
    users: [1, 2, 3, 4, 5, 6].map((n) => ({
      id: givingId(n),
      full_name: `Member ${n}`,
      email: `member${n}@example.test`,
    })),
    churches: [
      {
        id: givingChurch,
        name: 'Grace Church',
        logo_url: null,
        address: 'Nairobi',
        phone: '+254700000000',
        email: 'church@example.test',
      },
    ],
  }
  const dbRequests: { url: URL; method: string; body: Row | null }[] = []
  const providerRequests: { url: URL; body: Row | null; headers: Headers }[] =
    []
  const confirmations: Row[] = []
  const controls: {
    tokenFailure?: boolean
    pushError?: Error
    pushResponse?: Row
    queryResponse?: Row
    saveFailure?: boolean
    beforePushResponse?: (body: Row) => Promise<void>
  } = {}
  const history = () => [
    ...tables.offerings.map((row) => ({
      ...row,
      id: row.payment_id ?? row.id,
      offering_id: row.id,
      created_at:
        tables.giving_payments.find((payment) => payment.id === row.payment_id)
          ?.created_at ?? row.created_at,
      donor_name: row.receipt_details?.donor.full_name ?? 'Anonymous',
      donor_email: row.receipt_details?.donor.email ?? null,
      phone: row.receipt_details?.phone ?? null,
      destination_type: row.receipt_details?.destination_type ?? null,
      destination_number: row.receipt_details?.destination_number ?? null,
    })),
    ...tables.giving_payments
      .filter((row) => !row.offering_id)
      .map((row) => ({
        ...row,
        id: row.id,
        payment_id: row.id,
        offering_id: null,
        status: row.status === 'initiating' ? 'pending' : row.status,
        given_at: row.created_at,
        currency: 'KES',
        method: 'mpesa',
        donor_name: row.receipt_details.donor.full_name,
        donor_email: row.receipt_details.donor.email,
        reference: row.mpesa_receipt,
        receipt_number: null,
      })),
  ]
  const db = createClient('https://giving-database.example.test', 'fake-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input)),
          method = init?.method ?? 'GET'
        const body = init?.body ? JSON.parse(String(init.body)) : null
        dbRequests.push({ url, method, body })
        if (url.pathname.includes('/rpc/confirm_giving_payment')) {
          confirmations.push(body)
          const payment = tables.giving_payments.find(
            (row) => row.id === body.p_id
          )!
          if (!payment.offering_id) {
            payment.offering_id = givingId(20_000 + tables.offerings.length)
            tables.offerings.push({
              id: payment.offering_id,
              church_id: payment.church_id,
              membership_id: payment.membership_id,
              payment_id: payment.id,
              amount: payment.amount,
              currency: 'KES',
              type: payment.type,
              method: 'mpesa',
              status: payment.environment === 'sandbox' ? 'test' : 'completed',
              receipt_number: `RCP-${payment.offering_id}`,
              given_at: body.p_paid_at ?? new Date().toISOString(),
              created_at: new Date().toISOString(),
              reference: body.p_receipt,
              receipt_details: payment.receipt_details,
            })
          }
          Object.assign(payment, {
            status: 'succeeded',
            error: null,
            confirmed_at: new Date().toISOString(),
          })
          return Response.json(payment)
        }
        const table = url.pathname.split('/').pop()!
        const source: Row[] =
          table === 'giving_history' ? history() : tables[table]
        if (!source) throw new Error(`Unimplemented test table: ${table}`)
        let rows = source.filter((row) =>
          [...url.searchParams.entries()].every(([field, value]) => {
            if (
              ['select', 'order', 'limit', 'offset', 'on_conflict'].includes(
                field
              )
            )
              return true
            if (field === 'or')
              return splitLogical(value.slice(1, -1)).some((item) =>
                predicate(row, item)
              )
            return predicate(row, `${field}.${value}`)
          })
        )
        if (method === 'POST') {
          if (table === 'church_giving_settings') {
            Object.assign(source[0], body)
            rows = [source[0]]
          } else {
            const created: Row = {
              status: 'initiating',
              error: null,
              checkout_request_id: null,
              merchant_request_id: null,
              mpesa_receipt: null,
              offering_id: null,
              last_checked_at: null,
              confirmed_at: null,
              created_at: new Date().toISOString(),
              ...body,
            }
            source.push(created)
            rows = [created]
          }
        }
        if (method === 'PATCH') {
          if (controls.saveFailure && table === 'giving_payments') {
            controls.saveFailure = false
            return Response.json(
              { message: 'Simulated database failure', code: 'XX000' },
              { status: 500 }
            )
          }
          rows.forEach((row) => Object.assign(row, body))
        }
        const count = rows.length
        const orders = url.searchParams.get('order')?.split(',') ?? []
        rows = [...rows].sort((a, b) => {
          for (const order of orders) {
            const [field, direction] = order.split('.')
            const compared = String(a[field] ?? '').localeCompare(
              String(b[field] ?? '')
            )
            if (compared) return direction === 'desc' ? -compared : compared
          }
          return 0
        })
        const offset = Number(url.searchParams.get('offset') ?? 0),
          limit = Number(url.searchParams.get('limit') ?? 1000)
        rows = rows.slice(offset, offset + limit)
        const headers = {
          'Content-Type': 'application/json',
          'Content-Range': `0-${Math.max(0, rows.length - 1)}/${count}`,
        }
        if (method === 'HEAD') return new Response(null, { headers })
        const single = new Headers(init?.headers)
          .get('accept')
          ?.includes('vnd.pgrst.object')
        return Response.json(single ? (rows[0] ?? null) : rows, { headers })
      },
    },
  })
  const provider = new DarajaClient(async (input, init) => {
    const url = new URL(String(input)),
      body = init?.body ? JSON.parse(String(init.body)) : null
    providerRequests.push({ url, body, headers: new Headers(init?.headers) })
    if (url.pathname.includes('/oauth/'))
      return Response.json(
        controls.tokenFailure
          ? { error: 'Bad credentials' }
          : { access_token: 'test-token' },
        { status: controls.tokenFailure ? 401 : 200 }
      )
    if (url.pathname.includes('/processrequest')) {
      if (controls.pushError) throw controls.pushError
      if (controls.beforePushResponse) await controls.beforePushResponse(body)
      return Response.json(
        controls.pushResponse ?? {
          ResponseCode: '0',
          CheckoutRequestID: 'checkout-1',
          MerchantRequestID: 'merchant-1',
        }
      )
    }
    if (url.pathname.includes('/query'))
      return Response.json(
        controls.queryResponse ?? {
          ResponseCode: '0',
          ResultCode: '0',
          CheckoutRequestID: body.CheckoutRequestID,
          MerchantRequestID: 'merchant-1',
        }
      )
    throw new Error('Unexpected provider request')
  })
  const engine = new GivingEngine(db, {
    publicUrl: 'https://church.example.test',
    callbackPath: '/api/giving/callback',
    encryptionKey: givingKey,
    provider,
  })
  return {
    engine,
    db,
    tables,
    controls,
    settings,
    providerRequests,
    dbRequests,
    confirmations,
    payment: () => tables.giving_payments[0] as GivingPayment,
    callback: (overrides: Row = {}) => ({
      Body: {
        stkCallback: {
          CheckoutRequestID: 'checkout-1',
          MerchantRequestID: 'merchant-1',
          ResultCode: 0,
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 500 },
              { Name: 'PhoneNumber', Value: 254712345678 },
              { Name: 'MpesaReceiptNumber', Value: 'ABC1234567' },
              { Name: 'TransactionDate', Value: 20261112120000 },
            ],
          },
          ...overrides,
        },
      },
    }),
    callbackToken: () =>
      new URL(
        providerRequests.find((request) =>
          request.url.pathname.includes('/processrequest')
        )!.body!.CallBackURL
      ).searchParams.get('token')!,
  }
}

export function manualGivingRow(n: number, membership = givingId(1002)) {
  return {
    id: givingId(50_000 + n),
    church_id: givingChurch,
    membership_id: membership,
    payment_id: null,
    amount: 10,
    currency: 'KES',
    type: 'general',
    method: 'cash',
    status: 'completed',
    reference: null,
    receipt_number: `RCP-${n}`,
    given_at: '2026-01-01T09:00:00.000Z',
    created_at: '2026-01-01T09:00:00.000Z',
    receipt_details: {
      church: { name: 'Grace Church' },
      donor: { full_name: `Donor ${n}`, email: null },
    } as ReceiptDetails,
  }
}
