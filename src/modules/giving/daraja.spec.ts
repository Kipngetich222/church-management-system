import { DarajaClient, DarajaRejected } from './daraja'
import {
  callbackTokenHash,
  createCallbackToken,
  decryptGivingCredentials,
  encryptGivingCredentials,
  givingCallbackBase,
  validCallbackToken,
} from './giving-security'
import {
  givingCredentials,
  givingKey,
} from '../../../test/helpers/giving-fixture'

const account = {
  ...givingCredentials,
  environment: 'production' as const,
  businessShortCode: '123456',
  destinationNumber: '123456',
  destinationType: 'paybill' as const,
}
const input = {
  amount: 100,
  phone: '254712345678',
  reference: 'CHURCH',
  callbackUrl: 'https://church.example.test/api/giving/callback',
}
describe('Daraja transport and protected church credentials', () => {
  afterEach(() => jest.restoreAllMocks())
  it('signs requests using the business shortcode and an East Africa timestamp', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-11-12T09:34:56Z').getTime())
    const calls: RequestInit[] = []
    const provider = new DarajaClient(async (_url, options) => {
      calls.push(options!)
      return Response.json({ ResponseCode: '0', CheckoutRequestID: 'checkout' })
    })
    await provider.push(account, 'token', input)
    const body = JSON.parse(String(calls[0].body))
    expect(body.Timestamp).toBe('20261112123456')
    expect(Buffer.from(body.Password, 'base64').toString()).toBe(
      '123456test-passkey20261112123456'
    )
    expect(calls[0].signal).toBeInstanceOf(AbortSignal)
    expect(body.Amount).toBe(100)
  })
  it('distinguishes explicit provider rejections from ambiguous server errors', async () => {
    const rejected = new DarajaClient(async () =>
      Response.json({ errorCode: '400.002.02' }, { status: 400 })
    )
    await expect(rejected.push(account, 'token', input)).rejects.toBeInstanceOf(
      DarajaRejected
    )
    const unknown = new DarajaClient(async () =>
      Response.json({ errorCode: '500.001' }, { status: 500 })
    )
    await expect(
      unknown.push(account, 'token', input)
    ).rejects.not.toBeInstanceOf(DarajaRejected)
  })
  it.each(['phone', 'pochi'] as const)(
    'never sends a Daraja request for unsupported %s collection',
    async (destinationType) => {
      const fetcher = jest.fn()
      const provider = new DarajaClient(fetcher)
      await expect(
        provider.push({ ...account, destinationType }, 'token', input)
      ).rejects.toThrow('requires an STK provider')
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('encrypts each save with a fresh nonce and rejects tampered ciphertext', () => {
    const first = encryptGivingCredentials(givingCredentials, givingKey)
    expect(first).not.toContain(givingCredentials.consumerSecret)
    expect(encryptGivingCredentials(givingCredentials, givingKey)).not.toBe(
      first
    )
    expect(decryptGivingCredentials(first, givingKey)).toEqual(
      givingCredentials
    )
    const broken = first.slice(0, -2) + (first.endsWith('aa') ? 'bb' : 'aa')
    expect(() => decryptGivingCredentials(broken, givingKey)).toThrow(
      'could not be opened'
    )
    expect(() => decryptGivingCredentials(first, 'cd'.repeat(32))).toThrow(
      'could not be opened'
    )
    expect(() => encryptGivingCredentials(givingCredentials, '')).toThrow(
      'not configured'
    )
  })
  it('binds callbacks to an unguessable token stored only as a hash', () => {
    const token = createCallbackToken(),
      hash = callbackTokenHash(token)
    expect(token).not.toBe(hash)
    expect(validCallbackToken(token, hash)).toBe(true)
    expect(validCallbackToken(createCallbackToken(), hash)).toBe(false)
    expect(validCallbackToken('malformed', hash)).toBe(false)
  })
  it('requires an HTTPS callback origin without embedded credentials or local addresses', () => {
    expect(givingCallbackBase('https://church.example.test')).toBe(
      'https://church.example.test'
    )
    for (const url of [
      'http://church.example.test',
      'https://localhost',
      'https://192.168.1.2',
      'https://10.0.0.1',
      'https://user:password@church.example.test',
      'https://church.example.test?redirect=elsewhere',
    ])
      expect(givingCallbackBase(url)).toBe(null)
  })
})
