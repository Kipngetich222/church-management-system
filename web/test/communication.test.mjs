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
  MPESA_TRANSACTION_TYPE: 'CustomerPayBillOnline',
  MPESA_PARTY_B: '',
  NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY: 'KE',
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
    providerResult = {
      ResponseCode: '0',
      ResultCode: '0',
      CheckoutRequestID: 'checkout-test',
    },
    initiationResult = {
      ResponseCode: '0',
      CheckoutRequestID: 'checkout-test',
      MerchantRequestID: 'merchant-test',
    },
    initiationStatus = 200,
    oauthStatus = 200,
    saveCheckoutFailure = false,
    confirmedBeforeSaveResponse = false,
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
    confirmations = 0,
    scheduledCalls = 0
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
            if (
              purchase &&
              (purchase.request_id === body.request_id ||
                (purchase.environment === body.environment &&
                  ['initiating', 'pending', 'review'].includes(
                    purchase.status
                  )))
            )
              return Response.json(
                { code: '23505', message: 'Duplicate purchase' },
                { status: 409 }
              )
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
            const statusFilter = parsed.searchParams.get('status')
            if (
              statusFilter?.startsWith('eq.') &&
              statusFilter !== `eq.${purchase.status}`
            )
              return respond([])
            if (confirmedBeforeSaveResponse && body.status === 'pending') {
              Object.assign(purchase, body, { status: 'paid' })
              return Response.json(
                { message: 'Save response interrupted after confirmation' },
                { status: 503 }
              )
            }
            if (saveCheckoutFailure && body.status === 'pending')
              return Response.json(
                { message: 'Temporary database outage' },
                { status: 503 }
              )
            Object.assign(purchase, body)
            return respond([purchase])
          }
          const churchFilter = parsed.searchParams.get('church_id')
          const requestFilter = parsed.searchParams.get('request_id')
          const environmentFilter = parsed.searchParams.get('environment')
          return respond(
            purchase &&
              (!churchFilter || churchFilter === `eq.${purchase.church_id}`) &&
              (!requestFilter ||
                requestFilter === `eq.${purchase.request_id}`) &&
              (!environmentFilter ||
                environmentFilter === `eq.${purchase.environment}`)
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
      headers: options.headers,
    })
    if (String(url).includes('/oauth/'))
      return Response.json(
        oauthStatus === 200
          ? { access_token: 'provider-access-token' }
          : { errorCode: '401' },
        { status: oauthStatus }
      )
    if (String(url).includes('/processrequest')) {
      if (sendFailure) throw new Error('network timeout')
      return Response.json(initiationResult, { status: initiationStatus })
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
    runScheduled: async () => {
      scheduledCalls++
      return []
    },
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
    const testModule = { exports: {} }
    loaded.set(filename, testModule)
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
      testModule,
      testModule.exports
    )
    return testModule.exports
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
    get scheduledCalls() {
      return scheduledCalls
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

test('Vercel Hobby deployment uses daily cron jobs and Fluid compute', () => {
  const config = JSON.parse(
    readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
  )
  assert.equal(config.fluid, true)
  assert.equal(config.crons.length, 2)
  assert.deepEqual(
    new Set(config.crons.map((job) => job.path)),
    new Set(['/api/cron/daily', '/api/cron/scheduled-messages'])
  )
  for (const job of config.crons) {
    const [minute, hour, day, month, weekday] = job.schedule.split(' ')
    assert.match(minute, /^\d{1,2}$/)
    assert.match(hour, /^\d{1,2}$/)
    assert(Number(minute) < 60 && Number(hour) < 24)
    assert.deepEqual([day, month, weekday], ['*', '*', '*'])
  }
})

test('the daily scheduled-message job still verifies payments and dispatches due campaigns', async (t) => {
  const f = fixture(t, { stored: pending })
  const response = await f.load('app/api/cron/scheduled-messages/route').GET(
    new Request('https://church.example.test/api/cron/scheduled-messages', {
      headers: { Authorization: 'Bearer cron-test' },
    })
  )
  assert.equal(response.status, 200)
  assert.equal(f.confirmations, 1)
  assert.equal(f.scheduledCalls, 1)
  assert.deepEqual(await response.json(), {
    results: [],
    purchases: { checked: 1, confirmed: 1 },
  })
})

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

test('default prices match Africa’s Talking Kenya Basic including VAT and M-Pesa rounding', async (t) => {
  for (const [credits, amount] of [
    [100, 93],
    [500, 464],
    [1000, 928],
    [5000, 4640],
  ])
    await t.test(`${credits} credits`, async (t) => {
      const f = fixture(t)
      delete process.env.SMS_CREDIT_PRICE_KES
      const config = f
        .load('lib/services/sms-purchases.service')
        .smsPurchaseConfiguration()
      assert.equal(config.enabled, true)
      assert.equal(config.unitPrice, 0.928)
      assert.equal(
        config.bundles.find((b) => b.credits === credits).amountKes,
        amount
      )
      const response = await f
        .load('app/api/sms/purchases/route')
        .POST(post({ ...buy, credits, quotedAmountKes: amount }))
      assert.equal(response.status, 200)
      assert.equal((await response.json()).amount_kes, amount)
      const request = f.providerCalls.find((call) =>
        call.url.includes('/processrequest')
      )
      assert.equal(request.body.Amount, amount)
      assert.equal(
        request.headers.Authorization,
        'Bearer provider-access-token'
      )
      assert(request.body.AccountReference.length <= 12)
      assert(request.body.TransactionDesc.length <= 13)
    })
})

test('stale bundle quotes are rejected before requesting payment', async (t) => {
  const f = fixture(t)
  const response = await f
    .load('app/api/sms/purchases/route')
    .POST(post({ ...buy, quotedAmountKes: 93 }))
  assert.equal(response.status, 409)
  assert.match((await response.json()).error, /price has changed/)
  assert.equal(f.providerCalls.length, 0)
  assert.equal(f.purchase, null)
})

test('invalid prices, credentials and callback addresses disable payment with actionable reasons', async (t) => {
  for (const [key, value] of [
    ['SMS_CREDIT_PRICE_KES', 'NaN'],
    ['SMS_CREDIT_PRICE_KES', '0'],
    ['SMS_CREDIT_PRICE_KES', '-1'],
    ['SMS_CREDIT_PRICE_KES', '1000000'],
    ['MPESA_CONSUMER_KEY', 'your-consumer-key'],
    ['MPESA_SHORTCODE', 'bad'],
    ['AFRICAS_TALKING_API_KEY', 'your_api_key'],
    ['SMS_PAYMENT_CALLBACK_SECRET', 'short'],
    ['MPESA_ENV', 'prod'],
    ['AFRICAS_TALKING_ENV', 'test'],
    ['AFRICAS_TALKING_USERNAME', 'live-username'],
    ['MPESA_TRANSACTION_TYPE', 'wrong'],
    ['MPESA_PARTY_B', 'invalid'],
    ['NEXT_PUBLIC_APP_URL', 'http://church.example.test'],
    ['NEXT_PUBLIC_APP_URL', 'https://localhost'],
    ['NEXT_PUBLIC_APP_URL', 'https://127.0.0.1'],
    ['NEXT_PUBLIC_APP_URL', 'https://church.example.test?wrong=true'],
  ])
    await t.test(`${key}=${value}`, async (t) => {
      const f = fixture(t)
      process.env[key] = value
      const config = f
        .load('lib/services/sms-purchases.service')
        .smsPurchaseConfiguration()
      assert.equal(config.enabled, false)
      assert(config.issues.length > 0)
      assert.equal(
        (await f.load('app/api/sms/purchases/route').POST(post(buy))).status,
        503
      )
      assert.equal(f.providerCalls.length, 0)
    })
})

test('valid Kenyan phone formats remain correct with a different app default country', async (t) => {
  for (const [phone, normalized] of [
    ['0712 345 678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['0112-345-678', '254112345678'],
  ])
    await t.test(phone, async (t) => {
      const f = fixture(t)
      process.env.NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY = 'UG'
      const response = await f
        .load('app/api/sms/purchases/route')
        .POST(post({ ...buy, phone }))
      assert.equal(response.status, 200)
      assert.equal(
        f.providerCalls.find((call) => call.url.includes('/processrequest'))
          .body.PhoneNumber,
        normalized
      )
    })
})

test('invalid and overlong phone numbers never send a prompt to a truncated number', async (t) => {
  for (const phone of [
    '07123456789',
    '+2547123456789',
    '+256772123456',
    '07123456',
    'phone0712345678',
    '0201234567',
  ])
    await t.test(phone, async (t) => {
      const f = fixture(t)
      assert.equal(
        (
          await f
            .load('app/api/sms/purchases/route')
            .POST(post({ ...buy, phone }))
        ).status,
        400
      )
      assert.equal(f.providerCalls.length, 0)
      assert.equal(f.purchase, null)
    })
})

test('buy-goods payments can use a receiving till distinct from the business shortcode', async (t) => {
  const f = fixture(t)
  process.env.MPESA_TRANSACTION_TYPE = 'CustomerBuyGoodsOnline'
  process.env.MPESA_PARTY_B = '512345'
  await f.load('app/api/sms/purchases/route').POST(post(buy))
  const request = f.providerCalls.find((call) =>
    call.url.includes('/processrequest')
  ).body
  assert.equal(request.TransactionType, 'CustomerBuyGoodsOnline')
  assert.equal(request.BusinessShortCode, '174379')
  assert.equal(request.PartyB, '512345')
})

test('live configuration targets the production M-Pesa endpoint', async (t) => {
  const f = fixture(t)
  process.env.MPESA_ENV = 'production'
  process.env.AFRICAS_TALKING_ENV = 'production'
  process.env.AFRICAS_TALKING_USERNAME = 'church-live'
  await f.load('app/api/sms/purchases/route').POST(post(buy))
  assert.equal(f.purchase.environment, 'production')
  assert(
    f.providerCalls.every((call) =>
      call.url.startsWith('https://api.safaricom.co.ke/')
    )
  )
})

test('explicit STK rejection allows another purchase while ambiguous responses remain held', async (t) => {
  for (const [initiationStatus, initiationResult, expected] of [
    [400, { errorCode: '400.002.02' }, 'failed'],
    [401, { errorCode: '401.002.01' }, 'failed'],
    [200, { ResponseCode: '1' }, 'failed'],
    [200, { errorCode: '400.002.02' }, 'failed'],
    [500, { errorCode: '500.001.1001' }, 'review'],
    [200, { ResponseCode: '0' }, 'review'],
    [200, { ResponseCode: '0', CheckoutRequestID: '' }, 'review'],
    [200, {}, 'review'],
  ])
    await t.test(
      `${initiationStatus} ${JSON.stringify(initiationResult)}`,
      async (t) => {
        const f = fixture(t, { initiationStatus, initiationResult })
        const response = await f
          .load('app/api/sms/purchases/route')
          .POST(post(buy))
        assert.equal(response.status, 200)
        assert.equal((await response.json()).status, expected)
        assert.equal(f.confirmations, 0)
      }
    )
})

test('credential errors do not leave a purchase blocking subsequent attempts', async (t) => {
  const f = fixture(t, { oauthStatus: 401 })
  assert.equal(
    (await f.load('app/api/sms/purchases/route').POST(post(buy))).status,
    503
  )
  assert.equal(f.purchase, null)
  assert.equal(f.providerCalls.length, 1)
})

test('a new request after an explicit rejection sends one new prompt', async (t) => {
  const f = fixture(t, { initiationResult: { ResponseCode: '1' } })
  const route = f.load('app/api/sms/purchases/route')
  assert.equal((await (await route.POST(post(buy))).json()).status, 'failed')
  assert.equal(
    (await (await route.POST(post({ ...buy, requestId: id(998) }))).json())
      .status,
    'failed'
  )
  assert.equal(
    f.providerCalls.filter((call) => call.url.includes('/processrequest'))
      .length,
    2
  )
})

test('another buyer gets the open purchase without another prompt', async (t) => {
  const f = fixture(t)
  const route = f.load('app/api/sms/purchases/route')
  await route.POST(post(buy))
  const response = await route.POST(
    post({ ...buy, requestId: id(998), credits: 500, phone: '0712345679' })
  )
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.status, 'pending')
  assert.equal(result.credits, buy.credits)
  assert.equal(result.phone, '254712345678')
  assert.equal(
    f.providerCalls.filter((call) => call.url.includes('/processrequest'))
      .length,
    1
  )
})

test('a checkout survives a failed initial database save and can still be reconciled', async (t) => {
  const f = fixture(t, { saveCheckoutFailure: true })
  const response = await f.load('app/api/sms/purchases/route').POST(post(buy))
  const purchase = await response.json()
  assert.equal(purchase.status, 'review')
  assert.equal(purchase.checkout_id, 'checkout-test')
  assert.equal(
    (
      await f
        .load('lib/services/sms-purchases.service')
        .verifySmsPurchase(purchase)
    ).status,
    'paid'
  )
  assert.equal(f.confirmations, 1)
})

test('a lost save response never regresses a concurrently confirmed purchase', async (t) => {
  const f = fixture(t, { confirmedBeforeSaveResponse: true })
  const response = await f.load('app/api/sms/purchases/route').POST(post(buy))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'paid')
  assert.equal(f.purchase.status, 'paid')
  assert.equal(f.purchase.checkout_id, 'checkout-test')
})

test('incomplete or mismatched query responses cannot credit or fail a purchase', async (t) => {
  for (const providerResult of [
    { ResponseCode: '0', ResultCode: '0' },
    {
      ResponseCode: '0',
      ResultCode: '0',
      CheckoutRequestID: 'another-checkout',
    },
    {
      ResponseCode: '0',
      ResultCode: '1032',
      CheckoutRequestID: 'another-checkout',
    },
  ])
    await t.test(JSON.stringify(providerResult), async (t) => {
      const f = fixture(t, { stored: pending, providerResult })
      await f
        .load('lib/services/sms-purchases.service')
        .verifySmsPurchase(f.purchase)
      assert.equal(f.purchase.status, 'pending')
      assert.equal(f.confirmations, 0)
    })
})

test('issued payments remain verifiable when new purchases are disabled by pricing or SMS configuration', async (t) => {
  const f = fixture(t, { stored: pending })
  process.env.SMS_CREDIT_PRICE_KES = 'invalid'
  delete process.env.AFRICAS_TALKING_API_KEY
  const service = f.load('lib/services/sms-purchases.service')
  assert.equal(service.smsPurchaseConfiguration().enabled, false)
  assert.deepEqual(await service.reconcileSmsPurchases(), {
    checked: 1,
    confirmed: 1,
  })
})

test('a purchase from another environment cannot be reused or confirmed', async (t) => {
  const f = fixture(t, {
    stored: {
      ...pending,
      environment: 'production',
      request_id: buy.requestId,
    },
  })
  assert.equal(
    (await f.load('app/api/sms/purchases/route').POST(post(buy))).status,
    409
  )
  await assert.rejects(
    f.load('lib/services/sms-purchases.service').verifySmsPurchase(f.purchase),
    /different SMS environment/
  )
  assert.equal(f.providerCalls.length, 0)
})

test('a successful payment callback verifies the checkout and records the matching receipt', async (t) => {
  const f = fixture(t)
  await f.load('app/api/sms/purchases/route').POST(post(buy))
  const callbackUrl = f.providerCalls.find((call) =>
    call.url.includes('/processrequest')
  ).body.CallBackURL
  const response = await f.load('app/api/sms/purchases/callback/route').POST(
    post(
      {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'checkout-test',
            ResultCode: 0,
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 150 },
                { Name: 'PhoneNumber', Value: 254712345678 },
                { Name: 'MpesaReceiptNumber', Value: 'TEST-RECEIPT' },
              ],
            },
          },
        },
      },
      callbackUrl
    )
  )
  assert.equal(response.status, 200)
  assert.equal(f.purchase.status, 'paid')
  assert.equal(f.purchase.receipt, 'TEST-RECEIPT')
  assert.equal(f.confirmations, 1)
  await f
    .load('lib/services/sms-purchases.service')
    .verifySmsPurchase(f.purchase)
  assert.equal(f.confirmations, 1)
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
    {
      ResponseCode: '0',
      ResultCode: '1032',
      CheckoutRequestID: 'checkout-test',
    },
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
