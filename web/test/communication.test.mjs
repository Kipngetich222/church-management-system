import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const church = id(100),
  purchaseId = id(200),
  actorId = id(1)
const defaultEnv = {
  AFRICAS_TALKING_ENV: 'sandbox',
  AFRICAS_TALKING_USERNAME: 'sandbox',
  AFRICAS_TALKING_API_KEY: 'sms-test-key',
  MPESA_ENV: 'sandbox',
  MPESA_CONSUMER_KEY: 'test',
  MPESA_CONSUMER_SECRET: 'test',
  MPESA_SHORTCODE: '174379',
  MPESA_PASSKEY: 'test',
  SMS_CREDIT_PRICE_KES: '1.5',
  SMS_PAYMENT_CALLBACK_SECRET: 'a'.repeat(64),
  NEXT_PUBLIC_APP_URL: 'https://church.example.test',
  CRON_SECRET: 'cron-test',
}

function fixture(
  t,
  {
    role = 'super_admin',
    signedIn = true,
    active = true,
    stored = null,
    providerResult = { ResponseCode: '0', ResultCode: '0' },
    sendFailure = false,
    campaignActor = actorId,
  } = {}
) {
  const previous = Object.fromEntries(
    Object.keys(defaultEnv).map((key) => [key, process.env[key]])
  )
  Object.assign(process.env, defaultEnv)
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const requests = [],
    providerCalls = [],
    campaigns = [],
    previews = []
  let purchase = stored ? { ...stored } : null,
    confirmations = 0
  const database = createClient('https://sms.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, options) => {
        const parsed = new URL(url),
          body = options.body ? JSON.parse(options.body) : null
        requests.push({ url: parsed, method: options.method, body })
        const singular = String(
          new Headers(options.headers).get('accept')
        ).includes('vnd.pgrst.object')
        const respond = (data) =>
          Response.json(singular ? (data[0] ?? null) : data)
        if (parsed.pathname.endsWith('/church_memberships'))
          return respond(
            active && role
              ? [{ id: id(1001), role, status: 'active', full_name: 'Admin' }]
              : []
          )
        if (parsed.pathname.endsWith('/sms_purchases')) {
          if (options.method === 'POST') {
            purchase = {
              ...body,
              id: purchaseId,
              status: 'initiating',
              checkout_id: null,
              receipt: null,
              error: null,
              created_at: '2026-11-10T12:00:00Z',
            }
            return respond([purchase])
          }
          if (options.method === 'PATCH') {
            Object.assign(purchase, body)
            return respond([purchase])
          }
          const churchFilter = parsed.searchParams.get('church_id')
          return respond(
            purchase &&
              (!churchFilter || churchFilter === `eq.${purchase.church_id}`)
              ? [purchase]
              : []
          )
        }
        if (parsed.pathname.endsWith('/rpc/confirm_sms_purchase')) {
          confirmations++
          purchase.status = 'paid'
          purchase.receipt = body.p_receipt
          return Response.json(purchase)
        }
        if (parsed.pathname.endsWith('/message_campaigns'))
          return respond([
            { id: id(300), created_by: campaignActor, church_id: church },
          ])
        if (parsed.pathname.endsWith('/rpc/edit_scheduled_message'))
          return Response.json({ id: id(300), status: 'scheduled' })
        if (parsed.pathname.endsWith('/rpc/sms_usage_summary'))
          return Response.json({
            purchased: 100,
            available: 90,
            used: 10,
            reserved: 0,
            breakdown: [],
          })
        if (parsed.pathname.endsWith('/rpc/record_sms_delivery'))
          return Response.json(null)
        throw new Error(`Unexpected database request ${parsed.pathname}`)
      },
    },
  })
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    providerCalls.push({
      url: String(url),
      body: options.body ? JSON.parse(options.body) : null,
    })
    if (String(url).includes('/oauth/'))
      return Response.json({ access_token: 'provider-access-token' })
    if (String(url).includes('/processrequest')) {
      if (sendFailure) throw new Error('network timeout')
      return Response.json({
        ResponseCode: '0',
        CheckoutRequestID: 'checkout-test',
        MerchantRequestID: 'merchant-test',
      })
    }
    if (String(url).includes('/query')) return Response.json(providerResult)
    throw new Error(`Unexpected provider URL ${url}`)
  })
  const serverClient = {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: {
      getUser: async () => ({
        data: {
          user: signedIn ? { id: actorId, email: 'admin@example.test' } : null,
        },
        error: null,
      }),
    },
  }
  const engine = {
    create: async (input, actor) => {
      campaigns.push({ input, actor })
      return {
        id: id(300),
        status: input.scheduledAt ? 'scheduled' : 'sent',
        error: null,
      }
    },
    preview: async (input, actor) => {
      previews.push({ input, actor })
      return {
        recipients: 5,
        reachable: 3,
        skipped: 2,
        parts: 1,
        credits: 3,
      }
    },
    runScheduled: async () => [],
  }
  const mocks = {
    '@/lib/supabase/admin': { createAdminClient: () => database },
    '@/lib/supabase/server': { createClient: async () => serverClient },
    '@/lib/services/communication.service': {
      smsEnvironment: () =>
        process.env.AFRICAS_TALKING_ENV === 'production'
          ? 'production'
          : 'sandbox',
      communicationEngine: () => engine,
    },
  }
  const loaded = new Map()
  function load(relative, from = sourceRoot) {
    let filename = path.resolve(from, relative)
    if (!filename.endsWith('.ts')) filename += '.ts'
    if (loaded.has(filename)) return loaded.get(filename).exports
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    const module = { exports: {} }
    loaded.set(filename, module)
    const localRequire = (name) => {
      if (name in mocks) return mocks[name]
      const resolved = name.startsWith('.')
        ? path.resolve(path.dirname(filename), name)
        : ''
      if (
        resolved ===
        path.resolve(sourceRoot, 'lib/services/communication.service')
      )
        return mocks['@/lib/services/communication.service']
      if (name.startsWith('@/')) return load(name.slice(2))
      if (name.startsWith('.')) return load(name, path.dirname(filename))
      return require(name)
    }
    new Function('require', 'module', 'exports', compiled)(
      localRequire,
      module,
      module.exports
    )
    return module.exports
  }
  return {
    load,
    requests,
    providerCalls,
    campaigns,
    previews,
    get purchase() {
      return purchase
    },
    get confirmations() {
      return confirmations
    },
  }
}
const post = (body, url = 'https://church.example.test/api/sms/purchases') =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const buy = {
  churchId: church,
  requestId: id(999),
  credits: 100,
  phone: '0712 345 678',
}
const pending = {
  id: purchaseId,
  church_id: church,
  environment: 'sandbox',
  credits: 100,
  amount_kes: 150,
  phone: '254712345678',
  status: 'pending',
  checkout_id: 'checkout-test',
}

test('purchase charges the server bundle price and uses the dedicated signed callback', async (t) => {
  const f = fixture(t),
    route = f.load('app/api/sms/purchases/route')
  const response = await route.POST(
    post({ ...buy, amount_kes: 1, status: 'paid' })
  )
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.amount_kes, 150)
  assert.equal(result.status, 'pending')
  assert.equal(f.confirmations, 0)
  const request = f.providerCalls.find((call) =>
    call.url.includes('/processrequest')
  ).body
  assert.equal(request.Amount, 150)
  assert.equal(request.PhoneNumber, '254712345678')
  assert.match(
    request.CallBackURL,
    /\/api\/sms\/purchases\/callback\?id=.+&token=[a-f0-9]{64}$/
  )
})
test('repeated purchase requests do not issue another payment prompt', async (t) => {
  const f = fixture(t),
    route = f.load('app/api/sms/purchases/route')
  await route.POST(post(buy))
  await route.POST(post(buy))
  assert.equal(
    f.providerCalls.filter((call) => call.url.includes('/processrequest'))
      .length,
    1
  )
})
test('only active super admins can buy credits', async (t) => {
  for (const options of [
    { role: 'dept_admin' },
    { role: 'member' },
    { active: false },
    { signedIn: false },
  ])
    await t.test(JSON.stringify(options), async (t) => {
      const f = fixture(t, options),
        response = await f.load('app/api/sms/purchases/route').POST(post(buy))
      assert.equal(response.status, options.signedIn === false ? 401 : 403)
      assert.equal(f.providerCalls.length, 0)
    })
})
test('an ambiguous STK initiation is held for review instead of retried', async (t) => {
  const f = fixture(t, { sendFailure: true }),
    route = f.load('app/api/sms/purchases/route')
  const response = await route.POST(post(buy))
  assert.equal((await response.json()).status, 'review')
  await route.POST(post(buy))
  assert.equal(
    f.providerCalls.filter((call) => call.url.includes('/processrequest'))
      .length,
    1
  )
})
test('purchasing is disabled when the provider environments do not match', async (t) => {
  const f = fixture(t)
  process.env.MPESA_ENV = 'production'
  assert.equal(
    (await f.load('app/api/sms/purchases/route').POST(post(buy))).status,
    503
  )
  assert.equal(f.providerCalls.length, 0)
})
test('a late receipt updates an already verified purchase without another payment query', async (t) => {
  const f = fixture(t, {
    stored: { ...pending, status: 'paid', receipt: null },
  })
  const service = f.load('lib/services/sms-purchases.service')
  const result = await service.verifySmsPurchase(f.purchase, 'LATE-RECEIPT')
  assert.equal(result.receipt, 'LATE-RECEIPT')
  assert.equal(f.providerCalls.length, 0)
  assert.equal(
    f.requests.filter((request) =>
      request.url.pathname.endsWith('/rpc/confirm_sms_purchase')
    ).length,
    1
  )
})

test('verification credits only an authenticated successful STK query', async (t) => {
  const f = fixture(t, { stored: pending }),
    route = f.load('app/api/sms/purchases/[purchaseId]/verify/route')
  const response = await route.POST(post({ churchId: church }), {
    params: Promise.resolve({ purchaseId }),
  })
  assert.equal((await response.json()).status, 'paid')
  assert.equal(f.confirmations, 1)
  assert.equal(
    f.providerCalls.find((call) => call.url.includes('/query')).body
      .CheckoutRequestID,
    'checkout-test'
  )
})
test('failed and pending provider responses never credit the wallet', async (t) => {
  for (const providerResult of [
    { ResponseCode: '0', ResultCode: '1032' },
    { errorCode: '500.001.1001' },
  ])
    await t.test(JSON.stringify(providerResult), async (t) => {
      const f = fixture(t, { stored: pending, providerResult }),
        route = f.load('app/api/sms/purchases/[purchaseId]/verify/route')
      const response = await route.POST(post({ churchId: church }), {
        params: Promise.resolve({ purchaseId }),
      })
      assert.equal(response.status, 200)
      assert.equal(f.confirmations, 0)
      assert.equal(
        f.purchase.status,
        providerResult.ResultCode ? 'failed' : 'pending'
      )
    })
})
test('purchase lookup is scoped to the authorized church', async (t) => {
  const f = fixture(t, { stored: { ...pending, church_id: id(777) } })
  const response = await f
    .load('app/api/sms/purchases/[purchaseId]/verify/route')
    .POST(post({ churchId: church }), {
      params: Promise.resolve({ purchaseId }),
    })
  assert.equal(response.status, 404)
  assert.equal(f.providerCalls.length, 0)
})
test('callback rejects invalid tokens and cannot use a forged success payload to mint credit', async (t) => {
  const f = fixture(t, {
    stored: pending,
    providerResult: { errorCode: '500.001.1001' },
  })
  const route = f.load('app/api/sms/purchases/callback/route')
  const payload = {
    Body: {
      stkCallback: {
        CheckoutRequestID: 'checkout-test',
        ResultCode: 0,
        CallbackMetadata: { Item: [] },
      },
    },
  }
  assert.equal(
    (
      await route.POST(
        post(
          payload,
          `https://church.example.test/api/sms/purchases/callback?id=${purchaseId}&token=bad`
        )
      )
    ).status,
    401
  )
  const token = f
    .load('lib/services/sms-purchases.service')
    .paymentCallbackToken(purchaseId)
  assert.equal(
    (
      await route.POST(
        post(
          payload,
          `https://church.example.test/api/sms/purchases/callback?id=${purchaseId}&token=${token}`
        )
      )
    ).status,
    200
  )
  assert.equal(f.confirmations, 0)
  assert.equal(f.purchase.status, 'pending')
})
test('message API validates JSON and allows authorized department administrators', async (t) => {
  const f = fixture(t, { role: 'dept_admin' }),
    route = f.load('app/api/messages/send/route')
  assert.equal(
    (
      await route.POST(
        new Request('https://church.example.test', {
          method: 'POST',
          body: 'bad json',
        })
      )
    ).status,
    400
  )
  const response = await route.POST(
    post({
      churchId: church,
      channel: 'sms',
      body: 'Hello',
      recipientFilter: { type: 'category', ids: ['youth'] },
      requestId: id(901),
      scheduledAt: '2099-01-01T12:00:00+03:00',
    })
  )
  assert.equal(response.status, 200)
  assert.equal(f.campaigns[0].actor, actorId)
  assert.equal(f.campaigns[0].input.recipientFilter.type, 'category')
})
test('scheduled previews use the original sender permissions and block other department admins', async (t) => {
  const payload = {
    churchId: church,
    channel: 'sms',
    body: 'Hello',
    recipientFilter: { type: 'all', ids: [] },
    requestId: id(901),
    campaignId: id(300),
    scheduledAt: '2099-01-01T12:00:00Z',
  }
  await t.test('super admin preview', async (t) => {
    const f = fixture(t, { campaignActor: id(2) })
    const response = await f
      .load('app/api/messages/preview/route')
      .POST(post(payload))
    assert.equal(response.status, 200)
    assert.equal(f.previews[0].actor, id(2))
  })
  await t.test('another department admin', async (t) => {
    const f = fixture(t, { role: 'dept_admin', campaignActor: id(2) })
    const response = await f
      .load('app/api/messages/preview/route')
      .POST(post(payload))
    assert.equal(response.status, 403)
    assert.equal(f.previews.length, 0)
  })
})

test('scheduled cron refuses an unset secret, including Bearer undefined', async (t) => {
  const f = fixture(t)
  delete process.env.CRON_SECRET
  const response = await f.load('app/api/cron/scheduled-messages/route').GET(
    new Request('https://church.example.test', {
      headers: { Authorization: 'Bearer undefined' },
    })
  )
  assert.equal(response.status, 401)
  assert.equal(f.providerCalls.length, 0)
})
