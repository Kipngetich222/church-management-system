import {
  GivingError,
  type GivingCredentials,
  type DestinationType,
} from './giving.types'

type DarajaAccount = GivingCredentials & {
  environment: 'sandbox' | 'production'
  businessShortCode: string
  destinationType: DestinationType
  destinationNumber: string
}
export type DarajaResponse = {
  ResponseCode?: string | number
  CheckoutRequestID?: string
  MerchantRequestID?: string
  ResultCode?: number | string
  errorCode?: string
}
/** A definitive rejection is different from a request whose response was lost. */
export class DarajaRejected extends GivingError {}
export class DarajaClient {
  constructor(private readonly request: typeof fetch = fetch) {}

  private base(account: DarajaAccount) {
    return account.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke'
  }
  async accessToken(account: DarajaAccount): Promise<string> {
    let response: Response
    try {
      response = await this.request(
        `${this.base(account)}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${account.consumerKey}:${account.consumerSecret}`).toString('base64')}`,
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        }
      )
      const data = (await response.json()) as { access_token?: string }
      if (!response.ok || !data.access_token) throw new Error('Token rejected')
      return data.access_token
    } catch {
      throw new GivingError(
        'M-Pesa could not connect. Please try later or ask the church administrator to check the payment setup.',
        503
      )
    }
  }
  private password(account: DarajaAccount) {
    // Daraja timestamps use the business's East Africa timezone.
    const timestamp = new Date(Date.now() + 3 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\D/g, '')
      .slice(0, 14)
    return {
      BusinessShortCode: account.businessShortCode,
      Timestamp: timestamp,
      Password: Buffer.from(
        `${account.businessShortCode}${account.passkey}${timestamp}`
      ).toString('base64'),
    }
  }
  private async post(
    account: DarajaAccount,
    path: string,
    token: string,
    body: Record<string, unknown>
  ): Promise<DarajaResponse> {
    const response = await this.request(`${this.base(account)}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    const data = (await response.json()) as DarajaResponse
    if (
      response.status >= 400 &&
      response.status < 500 &&
      typeof data.errorCode === 'string'
    )
      throw new DarajaRejected(
        'M-Pesa rejected the request. Check the phone number or ask the church administrator to check the payment setup.',
        503
      )
    if (!response.ok)
      throw new GivingError(
        'M-Pesa has not confirmed the request. Check its status shortly.',
        503
      )
    return data
  }
  async push(
    account: DarajaAccount,
    token: string,
    input: {
      phone: string
      amount: number
      reference: string
      callbackUrl: string
    }
  ): Promise<DarajaResponse> {
    if (!['paybill', 'till'].includes(account.destinationType))
      throw new GivingError(
        'This destination requires an STK provider that supports Pochi or mobile-number collection.',
        409
      )
    return this.post(account, '/mpesa/stkpush/v1/processrequest', token, {
      ...this.password(account),
      TransactionType:
        account.destinationType === 'till'
          ? 'CustomerBuyGoodsOnline'
          : 'CustomerPayBillOnline',
      Amount: input.amount,
      PartyA: input.phone,
      PartyB: account.destinationNumber,
      PhoneNumber: input.phone,
      CallBackURL: input.callbackUrl,
      AccountReference: input.reference,
      TransactionDesc: 'Church giving',
    })
  }
  async query(
    account: DarajaAccount,
    checkout: string
  ): Promise<DarajaResponse> {
    return this.post(
      account,
      '/mpesa/stkpushquery/v1/query',
      await this.accessToken(account),
      {
        ...this.password(account),
        CheckoutRequestID: checkout,
      }
    )
  }
}
