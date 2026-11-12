import {
  givingAdmin,
  givingChurch,
  givingCredentials,
  givingFixture,
  givingId,
  givingInput,
  givingMember,
  manualGivingRow,
} from '../../../test/helpers/giving-fixture'
import { GIVING_TYPES, validateGiving } from './giving.types'
import { givingCsv } from './giving-csv'
import { FinanceService } from '../finance/finance.service'

describe('Member STK giving through the real provider and database adapters', () => {
  it('creates a pending attempt, uses the church paybill and exact amount, and returns no secrets', async () => {
    const f = givingFixture()
    const result = await f.engine.start(givingMember, givingInput)
    expect(result.status).toBe('pending')
    expect(f.tables.offerings).toHaveLength(0)
    const sent = f.providerRequests.find((request) =>
      request.url.pathname.includes('processrequest')
    )!.body!
    expect(sent).toMatchObject({
      Amount: 500,
      PhoneNumber: '254712345678',
      BusinessShortCode: '123456',
      PartyB: '123456',
      TransactionType: 'CustomerPayBillOnline',
      AccountReference: 'CHURCH',
    })
    expect(sent.CallBackURL).toContain('/api/giving/callback?id=')
    expect(f.payment().checkout_request_id).toBe('checkout-1')
    expect(JSON.stringify(result)).not.toMatch(
      /credentials|token|consumer|passkey/i
    )
  })
  it('routes a till using Buy Goods and keeps its business shortcode distinct from PartyB', async () => {
    const f = givingFixture()
    f.settings.destination_type = 'till'
    f.settings.destination_number = '987654'
    await f.engine.start(givingMember, givingInput)
    expect(
      f.providerRequests.find((request) =>
        request.url.pathname.includes('processrequest')
      )!.body
    ).toMatchObject({
      TransactionType: 'CustomerBuyGoodsOnline',
      PartyB: '987654',
      BusinessShortCode: '123456',
    })
  })
  it('reuses an attempt across retries and other in-flight requests without sending another prompt', async () => {
    const f = givingFixture(),
      first = await f.engine.start(givingMember, givingInput)
    expect((await f.engine.start(givingMember, givingInput)).id).toBe(first.id)
    expect(
      (
        await f.engine.start(givingMember, {
          ...givingInput,
          requestId: givingId(10001),
        })
      ).id
    ).toBe(first.id)
    expect(
      f.providerRequests.filter((request) =>
        request.url.pathname.includes('processrequest')
      )
    ).toHaveLength(1)
    await expect(
      f.engine.start(givingMember, { ...givingInput, amount: 501 })
    ).rejects.toMatchObject({ status: 409 })
  })
  it.each([givingId(4), givingId(5)])(
    'blocks nonmembers and inactive members before calling M-Pesa (%s)',
    async (user) => {
      const f = givingFixture()
      await expect(f.engine.start(user, givingInput)).rejects.toMatchObject({
        status: 403,
      })
      expect(f.providerRequests).toHaveLength(0)
      expect(f.tables.giving_payments).toHaveLength(0)
    }
  )
  it('does not leave a charge behind when provider authentication fails', async () => {
    const f = givingFixture()
    f.controls.tokenFailure = true
    await expect(
      f.engine.start(givingMember, givingInput)
    ).rejects.toMatchObject({ status: 503 })
    expect(f.tables.giving_payments).toHaveLength(0)
  })
  it('treats a rejected STK response as failed rather than pending or successful', async () => {
    const f = givingFixture()
    f.controls.pushResponse = { ResponseCode: '1' }
    expect((await f.engine.start(givingMember, givingInput)).status).toBe(
      'failed'
    )
    expect(f.tables.offerings).toHaveLength(0)
  })
  it('holds a lost provider response for review and never automatically repeats the charge', async () => {
    const f = givingFixture()
    f.controls.pushError = new Error('Connection reset after sending')
    const result = await f.engine.start(givingMember, givingInput)
    expect(result.status).toBe('review')
    await f.engine.start(givingMember, givingInput)
    expect(
      f.providerRequests.filter((request) =>
        request.url.pathname.includes('processrequest')
      )
    ).toHaveLength(1)
    expect(f.tables.offerings).toHaveLength(0)
  })
  it('keeps the checkout for reconciliation if saving the accepted response fails', async () => {
    const f = givingFixture()
    f.controls.saveFailure = true
    expect((await f.engine.start(givingMember, givingInput)).status).toBe(
      'review'
    )
    expect(f.payment().checkout_request_id).toBe('checkout-1')
    expect(
      (await f.engine.verifyPayment(givingMember, givingChurch, f.payment().id))
        .status
    ).toBe('succeeded')
  })
  it('authenticates callbacks and checks amount, payer and checkout before reconciling', async () => {
    const f = givingFixture()
    await f.engine.start(givingMember, givingInput)
    await expect(
      f.engine.handleCallback(f.payment().id, '00'.repeat(32), f.callback())
    ).rejects.toMatchObject({ status: 401 })
    await expect(
      f.engine.handleCallback(
        f.payment().id,
        f.callbackToken(),
        f.callback({ CheckoutRequestID: 'someone-else' })
      )
    ).rejects.toMatchObject({ status: 400 })
    for (const [name, value] of [
      ['Amount', 1],
      ['PhoneNumber', 254712345679],
    ]) {
      const body = f.callback()
      const item = body.Body.stkCallback.CallbackMetadata.Item.find(
        (item: { Name: string }) => item.Name === name
      )!
      item.Value = value
      await expect(
        f.engine.handleCallback(f.payment().id, f.callbackToken(), body)
      ).rejects.toMatchObject({ status: 400 })
    }
    expect(f.confirmations).toHaveLength(0)
    await f.engine.handleCallback(
      f.payment().id,
      f.callbackToken(),
      f.callback()
    )
    expect(f.confirmations[0]).toMatchObject({
      p_checkout: 'checkout-1',
      p_receipt: 'ABC1234567',
      p_paid_at: '2026-11-12T09:00:00.000Z',
    })
    expect(f.payment().status).toBe('succeeded')
  })
  it('waits when the authenticated status query does not identify the same checkout', async () => {
    const f = givingFixture()
    await f.engine.start(givingMember, givingInput)
    f.controls.queryResponse = {
      ResponseCode: '0',
      ResultCode: '0',
      CheckoutRequestID: 'wrong-checkout',
    }
    await f.engine.handleCallback(
      f.payment().id,
      f.callbackToken(),
      f.callback()
    )
    expect(f.payment().status).toBe('pending')
    expect(f.tables.offerings).toHaveLength(0)
  })
  it('handles a callback arriving before the initiation HTTP response', async () => {
    const f = givingFixture()
    f.controls.beforePushResponse = async () => {
      await f.engine.handleCallback(
        f.payment().id,
        f.callbackToken(),
        f.callback()
      )
    }
    const result = await f.engine.start(givingMember, givingInput)
    expect(result.status).toBe('succeeded')
    expect(f.tables.offerings).toHaveLength(1)
  })
  it('recovers a missed callback by querying status using the original credentials after settings change', async () => {
    const f = givingFixture(),
      payment = await f.engine.start(givingMember, givingInput)
    f.settings.enabled = false
    f.settings.business_shortcode = '654321'
    f.settings.environment = 'sandbox'
    const result = await f.engine.verifyPayment(
      givingMember,
      givingChurch,
      payment.id
    )
    expect(result.status).toBe('succeeded')
    const query = f.providerRequests.find((request) =>
      request.url.pathname.includes('/query')
    )!
    expect(query.url.origin).toBe('https://api.safaricom.co.ke')
    expect(query.body!.BusinessShortCode).toBe('123456')
  })
  it('shows cancellations and throttles repeat status queries', async () => {
    const f = givingFixture(),
      payment = await f.engine.start(givingMember, givingInput)
    f.controls.queryResponse = {
      ResponseCode: '0',
      ResultCode: '1032',
      CheckoutRequestID: 'checkout-1',
    }
    const result = await f.engine.verifyPayment(
      givingMember,
      givingChurch,
      payment.id
    )
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/cancelled/)
    await f.engine.verifyPayment(givingMember, givingChurch, payment.id)
    expect(
      f.providerRequests.filter((request) =>
        request.url.pathname.includes('/query')
      )
    ).toHaveLength(1)
  })
  it('prevents another member reading status or downloading a receipt, and permits finance admins', async () => {
    const f = givingFixture(),
      payment = await f.engine.start(givingMember, givingInput)
    await expect(
      f.engine.getPayment(givingId(3), givingChurch, payment.id)
    ).rejects.toMatchObject({ status: 404 })
    await f.engine.verifyPayment(givingMember, givingChurch, payment.id)
    const offeringId = f.payment().offering_id!
    await expect(
      f.engine.receipt(givingId(3), givingChurch, offeringId)
    ).rejects.toMatchObject({ status: 404 })
    expect(
      (await f.engine.receipt(givingAdmin, givingChurch, offeringId))
        .receipt_number
    ).toBeTruthy()
    expect(
      (await f.engine.receipt(givingMember, givingChurch, offeringId))
        .receipt_number
    ).toBeTruthy()
  })
})

describe('Church setup and complete giving history', () => {
  it('calculates finance totals beyond the default database row limit and excludes unconfirmed/test giving', async () => {
    const f = givingFixture()
    f.tables.offerings.push(
      ...Array.from({ length: 1005 }, (_, n) => manualGivingRow(n)),
      { ...manualGivingRow(2000), status: 'review', amount: 90000 },
      { ...manualGivingRow(2001), status: 'test', amount: 90000 }
    )
    f.tables.expenses = []
    const finance = new FinanceService({ admin: f.db } as any)
    const summary = await finance.summary(
      givingChurch,
      '2026-01-01',
      '2027-01-01'
    )
    expect(summary.totalIncome).toBe(10050)
    expect(summary.byType).toEqual([{ type: 'general', total: 10050 }])
  })
  it('accepts all categories and rejects fractional, out-of-range and non-Kenyan payments', () => {
    for (const type of GIVING_TYPES)
      expect(validateGiving({ ...givingInput, type }).type).toBe(type)
    for (const amount of [0, -1, 0.5, 1.5, 250001, Infinity, NaN])
      expect(() => validateGiving({ ...givingInput, amount })).toThrow()
    for (const phone of ['+256712345678', '2547123456789', 'letters', ''])
      expect(() => validateGiving({ ...givingInput, phone })).toThrow()
  })
  it('stores encrypted credentials without returning them and prevents non-admin setup changes', async () => {
    const f = givingFixture()
    const input = {
      enabled: true,
      destinationType: 'paybill' as const,
      destinationNumber: '123456',
      businessShortCode: '123456',
      accountReference: '',
      environment: 'production' as const,
      ...givingCredentials,
    }
    await expect(
      f.engine.saveSettings(givingMember, givingChurch, input)
    ).rejects.toMatchObject({ status: 403 })
    const result = await f.engine.saveSettings(givingAdmin, givingChurch, input)
    expect(result.ready).toBe(true)
    expect(result.hasCredentials).toBe(true)
    expect(JSON.stringify(result)).not.toContain(
      givingCredentials.consumerSecret
    )
    expect(result).not.toHaveProperty('credentials_ciphertext')
    expect(f.settings.credentials_ciphertext).not.toContain(
      givingCredentials.passkey
    )
  })
  it.each(['pochi', 'phone'] as const)(
    'saves %s destinations without falsely offering unsupported STK',
    async (destinationType) => {
      const f = givingFixture()
      const input = {
        enabled: false,
        destinationType,
        destinationNumber: '0712345678',
        businessShortCode: '',
        accountReference: '',
        environment: 'production' as const,
      }
      const result = await f.engine.saveSettings(
        givingAdmin,
        givingChurch,
        input
      )
      expect(result.destination_number).toBe('254712345678')
      expect(result.ready).toBe(false)
      await expect(
        f.engine.saveSettings(givingAdmin, givingChurch, {
          ...input,
          enabled: true,
        })
      ).rejects.toMatchObject({ status: 409 })
      await expect(
        f.engine.start(givingMember, givingInput)
      ).rejects.toMatchObject({ status: 409 })
      expect(f.providerRequests).toHaveLength(0)
    }
  )
  it('requires replacement credentials when switching environment', async () => {
    const f = givingFixture()
    await expect(
      f.engine.saveSettings(givingAdmin, givingChurch, {
        enabled: true,
        destinationType: 'paybill',
        destinationNumber: '123456',
        businessShortCode: '123456',
        accountReference: '',
        environment: 'sandbox',
      })
    ).rejects.toMatchObject({ status: 409 })
  })
  it('paginates history and exports every matching row beyond the old 20/500 record limits', async () => {
    const f = givingFixture()
    f.tables.offerings.push(
      ...Array.from({ length: 1005 }, (_, n) => manualGivingRow(n))
    )
    f.tables.offerings.push(manualGivingRow(2000, givingId(1003)))
    const history = await f.engine.history(givingMember, givingChurch, 'mine', {
      page: 2,
    })
    expect(history.total).toBe(1005)
    expect(history.rows).toHaveLength(25)
    await expect(
      f.engine.history(givingMember, givingChurch, 'church')
    ).rejects.toMatchObject({ status: 403 })
    const data = await f.engine.exportHistory(
      givingMember,
      givingChurch,
      'mine'
    )
    const ids: string[] = []
    for await (const row of data.rows) ids.push(row.id)
    expect(new Set(ids).size).toBe(1005)
    expect(ids).not.toContain(givingId(52000))
  })
  it('treats the selected end date as inclusive in Nairobi time', async () => {
    const f = givingFixture()
    f.tables.offerings.push(
      { ...manualGivingRow(1), given_at: '2026-11-11T21:00:00.000Z' },
      { ...manualGivingRow(2), given_at: '2026-11-12T20:59:59.000Z' },
      { ...manualGivingRow(3), given_at: '2026-11-12T21:00:00.000Z' }
    )
    const history = await f.engine.history(givingMember, givingChurch, 'mine', {
      from: '2026-11-12',
      to: '2026-11-12',
    })
    expect(history.rows).toHaveLength(2)
    await expect(
      f.engine.history(givingMember, givingChurch, 'mine', {
        from: '2026-02-31',
      })
    ).rejects.toThrow('Invalid history date')
  })
  it('exports recorded gifts with a future giving date without truncating them at the current date', async () => {
    const f = givingFixture()
    f.tables.offerings.push({
      ...manualGivingRow(1),
      given_at: '2099-01-01T09:00:00.000Z',
    })
    const exported = await f.engine.exportHistory(
      givingMember,
      givingChurch,
      'mine'
    )
    const ids: string[] = []
    for await (const row of exported.rows) ids.push(row.id)
    expect(ids).toEqual([givingId(50001)])
  })
  it('escapes CSV values and neutralizes spreadsheet formulas', async () => {
    const f = givingFixture()
    const row = manualGivingRow(1)
    row.receipt_details.donor.full_name = '=HYPERLINK("evil")'
    f.tables.offerings.push(row)
    const data = await f.engine.exportHistory(
      givingMember,
      givingChurch,
      'mine'
    )
    let csv = ''
    for await (const line of givingCsv('Church, "Name"', data.rows)) csv += line
    expect(csv).toContain('"Church, ""Name"""')
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"')
  })
})
