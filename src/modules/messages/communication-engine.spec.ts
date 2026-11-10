import { CommunicationEngine, communicationDb } from './communication-engine'
import {
  CommunicationError,
  smsSegments,
  validateCampaign,
  type CampaignInput,
} from './communication.types'
import { sendAfricasTalking } from './africas-talking'

const input: CampaignInput = {
  churchId: 'church',
  body: 'Hello',
  channel: 'sms',
  recipientFilter: { type: 'all', ids: [] },
  requestId: 'request',
}
describe('SMS counting and audience validation', () => {
  it.each([
    ['', 0],
    ['a'.repeat(160), 1],
    ['a'.repeat(161), 2],
    ['a'.repeat(306), 2],
    ['a'.repeat(307), 3],
    ['^'.repeat(80), 1],
    ['^'.repeat(81), 2],
    ['🙂'.repeat(35), 1],
    ['🙂'.repeat(36), 2],
    ['漢'.repeat(70), 1],
    ['漢'.repeat(71), 2],
  ])('counts GSM and Unicode parts', (body, parts) =>
    expect(smsSegments(body)).toBe(parts)
  )
  it.each(['department', 'group', 'custom', 'category'])(
    'rejects empty %s selections',
    (type) =>
      expect(() =>
        validateCampaign({
          ...input,
          recipientFilter: { type: type as 'custom', ids: [] },
        })
      ).toThrow(CommunicationError)
  )
  it('rejects past, invalid and timezone-free schedules', () => {
    for (const scheduledAt of [
      '2020-01-01T12:00:00Z',
      'nonsense',
      '2099-01-01T12:00:00',
    ])
      expect(() => validateCampaign({ ...input, scheduledAt })).toThrow(
        CommunicationError
      )
    expect(() =>
      validateCampaign({ ...input, scheduledAt: '2099-01-01T12:00:00+03:00' })
    ).not.toThrow()
  })
})

function fixture({
  channel = 'sms',
  prepareError = false,
  claimed = true,
}: { channel?: string; prepareError?: boolean; claimed?: boolean } = {}) {
  const campaign = {
    id: 'campaign',
    church_id: 'church',
    created_by: 'admin',
    source: 'manual',
    channel,
    body: 'Hello',
    recipient_filter: { type: 'all', ids: [] },
  }
  const recipients = [
    {
      membership_id: 'one',
      name: 'One',
      phone: '+254712345678',
      email: 'one@example.test',
      user_id: 'user-one',
    },
    {
      membership_id: 'two',
      name: 'Two',
      phone: '+254712345679',
      email: 'two@example.test',
      user_id: 'user-two',
    },
  ]
  const messages = recipients.map((recipient, index) => ({
    id: recipient.membership_id,
    status: 'sending',
    to_address:
      channel === 'sms'
        ? recipient.phone
        : channel === 'email'
          ? recipient.email
          : recipient.user_id,
    credit_state: channel === 'sms' ? 'reserved' : 'none',
    sms_parts: 1,
    index,
  }))
  const rpc = jest.fn(async (name: string) => {
    if (name === 'claim_message_campaign')
      return { data: claimed ? campaign : null, error: null }
    if (name === 'communication_recipients')
      return { data: recipients, error: null }
    if (name === 'prepare_message_campaign')
      return {
        data: messages,
        error: prepareError ? { message: 'Insufficient SMS credits' } : null,
      }
    return { data: null, error: null }
  })
  const update = jest.fn(() => ({
    eq: async () => ({ error: null, data: null }),
  }))
  const sendSms = jest.fn().mockResolvedValue({
    SMSMessageData: {
      Recipients: [
        {
          number: recipients[0].phone,
          status: 'Success',
          messageId: 'provider-one',
        },
        { number: recipients[1].phone, status: 'InvalidPhoneNumber' },
      ],
    },
  })
  const sendEmail = jest.fn().mockResolvedValue(undefined)
  const engine = new CommunicationEngine(
    communicationDb({ rpc, from: () => ({ update }) }),
    {
      environment: 'sandbox',
      normalizePhone: (value) => value,
      ensureSmsConfigured: () => {},
      sendSms,
      sendEmail,
    }
  )
  return { engine, rpc, sendSms, sendEmail, update, recipients }
}
describe('Shared immediate and scheduled dispatch', () => {
  it('records actual recipient outcomes, including rejected submissions', async () => {
    const f = fixture()
    await f.engine.dispatch('campaign')
    expect(f.rpc).toHaveBeenCalledWith('settle_message_batch', {
      p_id: 'campaign',
      p_results: [
        expect.objectContaining({
          id: 'one',
          status: 'sent',
          provider_id: 'provider-one',
        }),
        expect.objectContaining({
          id: 'two',
          status: 'failed',
          error: 'InvalidPhoneNumber',
        }),
      ],
    })
  })
  it('does not send or charge again when another worker has claimed the campaign', async () => {
    const f = fixture({ claimed: false })
    expect(await f.engine.dispatch('campaign')).toBe(false)
    expect(f.sendSms).not.toHaveBeenCalled()
  })
  it('does not contact the provider without enough reserved credits', async () => {
    const f = fixture({ prepareError: true })
    await f.engine.dispatch('campaign')
    expect(f.sendSms).not.toHaveBeenCalled()
    expect(f.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    )
  })
  it('holds credit on transport uncertainty and never retries the provider', async () => {
    const f = fixture()
    f.sendSms.mockRejectedValue(new Error('timeout'))
    await f.engine.dispatch('campaign')
    expect(f.sendSms).toHaveBeenCalledTimes(1)
    const settlement = f.rpc.mock.calls.find(
      ([name]) => name === 'settle_message_batch'
    ) as unknown as [string, { p_results: { status: string }[] }]
    expect(
      settlement[1].p_results.every((row) => row.status === 'sending')
    ).toBe(true)
  })
  it('holds missing recipient results instead of claiming they were sent', async () => {
    const f = fixture()
    f.sendSms.mockResolvedValue({ SMSMessageData: { Recipients: [] } })
    await f.engine.dispatch('campaign')
    expect(f.rpc).toHaveBeenCalledWith(
      'settle_message_batch',
      expect.objectContaining({
        p_results: [
          expect.objectContaining({ status: 'sending' }),
          expect.objectContaining({ status: 'sending' }),
        ],
      })
    )
  })
  it('records private in-app messages through the same transactional notification path', async () => {
    const f = fixture({ channel: 'in_app' })
    await f.engine.dispatch('campaign')
    expect(f.sendSms).not.toHaveBeenCalled()
    expect(f.rpc).toHaveBeenCalledWith(
      'prepare_message_campaign',
      expect.objectContaining({
        p_parts: 0,
        p_rows: [
          expect.objectContaining({ to_address: 'user-one' }),
          expect.objectContaining({ to_address: 'user-two' }),
        ],
      })
    )
    expect(f.rpc).toHaveBeenCalledWith('settle_message_batch', {
      p_id: 'campaign',
      p_results: [
        { id: 'one', status: 'sent' },
        { id: 'two', status: 'sent' },
      ],
    })
  })
  it('sends email and records failures', async () => {
    const f = fixture({ channel: 'email' })
    f.sendEmail.mockRejectedValueOnce(new Error('Rejected'))
    await f.engine.dispatch('campaign')
    expect(f.sendEmail).toHaveBeenCalledTimes(2)
    expect(f.rpc).toHaveBeenCalledWith(
      'settle_message_batch',
      expect.objectContaining({
        p_results: [
          expect.objectContaining({ status: 'failed' }),
          expect.objectContaining({ status: 'sent' }),
        ],
      })
    )
  })
  it('deduplicates phones and records missing contacts without consuming credits', () => {
    const f = fixture()
    const rows = f.engine.prepare(
      [
        ...f.recipients,
        { ...f.recipients[0], membership_id: 'duplicate' },
        { ...f.recipients[0], membership_id: 'missing', phone: null },
      ],
      'sms'
    )
    expect(rows.map((row) => row.status)).toEqual([
      'sending',
      'sending',
      'failed',
      'failed',
    ])
  })
})
describe('Africa’s Talking transport', () => {
  afterEach(() => jest.restoreAllMocks())
  it('checks credentials before any request', async () => {
    const fetch = jest.spyOn(global, 'fetch')
    await expect(
      sendAfricasTalking({ environment: 'sandbox' }, ['+254712345678'], 'Hello')
    ).rejects.toThrow('not configured')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses the correct live endpoint and refuses HTTP failures', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 401 }))
    await expect(
      sendAfricasTalking(
        { environment: 'production', username: 'app', apiKey: 'secret' },
        ['+254712345678'],
        'Hello'
      )
    ).rejects.toThrow('HTTP 401')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.africastalking.com/version1/messaging',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
