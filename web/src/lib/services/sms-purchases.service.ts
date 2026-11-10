import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { toMpesaPhone } from '@/lib/phone'
import { appBaseUrl } from '@/lib/utils/app-url'
import {
  checked,
  communicationDb,
  CommunicationError,
  type SmsEnvironment,
} from '@/lib/communication'
import { smsEnvironment } from './communication.service'

export type SmsPurchase = {
  id: string
  church_id: string
  environment: SmsEnvironment
  credits: number
  amount_kes: number
  phone: string
  status: string
  checkout_id: string | null
  receipt: string | null
  error: string | null
  created_by_name: string
  created_at: string
  paid_at: string | null
}
export const SMS_BUNDLES = [100, 500, 1000, 5000]
export function smsPurchaseConfiguration() {
  const unitPrice = Number(process.env.SMS_CREDIT_PRICE_KES)
  const configured = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_SHORTCODE',
    'MPESA_PASSKEY',
    'SMS_PAYMENT_CALLBACK_SECRET',
    'AFRICAS_TALKING_API_KEY',
    'AFRICAS_TALKING_USERNAME',
  ].every((key) => Boolean(process.env[key]))
  const environmentMatches =
    (process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox') ===
    smsEnvironment()
  return {
    enabled:
      configured &&
      environmentMatches &&
      Number.isFinite(unitPrice) &&
      unitPrice > 0 &&
      appBaseUrl().startsWith('https://'),
    unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
    environment: smsEnvironment(),
  }
}
function paymentConfig() {
  const config = smsPurchaseConfiguration()
  if (!config.enabled)
    throw new CommunicationError(
      'SMS purchasing is not configured. Contact the platform administrator.',
      503
    )
  return {
    ...config,
    base:
      process.env.MPESA_ENV === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke',
  }
}
function password() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  return {
    Timestamp: timestamp,
    Password: Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64'),
    BusinessShortCode: process.env.MPESA_SHORTCODE!,
  }
}
async function token() {
  const config = paymentConfig()
  const response = await fetch(
    `${config.base}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64')}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    }
  )
  const data = await response.json()
  if (!response.ok || !data.access_token)
    throw new CommunicationError(
      'M-Pesa is unavailable. Please try again later.',
      503
    )
  return data.access_token as string
}
async function mpesaRequest(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
) {
  const response = await fetch(`${paymentConfig().base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
  })
  const data = await response.json()
  if (!response.ok)
    throw new CommunicationError(
      'M-Pesa has not confirmed the request. Check the payment status shortly.',
      503
    )
  return data
}
export function paymentCallbackToken(id: string) {
  const secret = process.env.SMS_PAYMENT_CALLBACK_SECRET
  if (!secret)
    throw new CommunicationError('Payment confirmation is not configured', 503)
  return createHmac('sha256', secret).update(id).digest('hex')
}
export function validPaymentCallback(id: string, value: string) {
  if (!/^[a-f0-9]{64}$/.test(value) || !process.env.SMS_PAYMENT_CALLBACK_SECRET)
    return false
  return timingSafeEqual(
    Buffer.from(value, 'hex'),
    Buffer.from(paymentCallbackToken(id), 'hex')
  )
}

export async function purchaseSms(
  input: {
    churchId: string
    requestId: string
    credits: number
    phone: string
  },
  userId: string,
  name: string
) {
  const config = paymentConfig()
  if (!SMS_BUNDLES.includes(input.credits))
    throw new CommunicationError('Select a valid SMS bundle')
  let phone: string
  try {
    phone = toMpesaPhone(input.phone)
  } catch {
    throw new CommunicationError('Enter a valid Kenyan M-Pesa number')
  }
  if (!/^254[17]\d{8}$/.test(phone))
    throw new CommunicationError('Enter a valid Kenyan M-Pesa number')
  const db = communicationDb(createAdminClient())
  const existing = checked(
    await db
      .from('sms_purchases')
      .select('*')
      .eq('church_id', input.churchId)
      .eq('request_id', input.requestId)
      .maybeSingle()
  ) as SmsPurchase | null
  if (existing) return existing
  // Resolve credentials before creating a pending purchase. A timed-out STK
  // request after this point is held for review, never automatically repeated.
  const accessToken = await token()
  const inserted = await db
    .from('sms_purchases')
    .insert({
      church_id: input.churchId,
      environment: config.environment,
      request_id: input.requestId,
      credits: input.credits,
      amount_kes: Math.ceil(input.credits * config.unitPrice!),
      phone,
      created_by: userId,
      created_by_name: name,
    })
    .select('*')
    .single()
  if (inserted.error?.code === '23505') {
    const concurrent = checked(
      await db
        .from('sms_purchases')
        .select('*')
        .eq('church_id', input.churchId)
        .eq('environment', config.environment)
        .in('status', ['initiating', 'pending', 'review'])
        .maybeSingle()
    )
    if (concurrent) return concurrent as SmsPurchase
  }
  const purchase = checked(inserted) as SmsPurchase
  try {
    const result = await mpesaRequest(
      '/mpesa/stkpush/v1/processrequest',
      {
        ...password(),
        TransactionType:
          process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
        Amount: purchase.amount_kes,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE!,
        PhoneNumber: phone,
        CallBackURL: `${appBaseUrl()}/api/sms/purchases/callback?id=${purchase.id}&token=${paymentCallbackToken(purchase.id)}`,
        AccountReference: `SMS${purchase.id.replace(/-/g, '').slice(0, 9)}`,
        TransactionDesc: 'Church SMS credits',
      },
      accessToken
    )
    const accepted =
      String(result.ResponseCode) === '0' &&
      typeof result.CheckoutRequestID === 'string'
    return checked(
      await db
        .from('sms_purchases')
        .update({
          status: accepted ? 'pending' : 'failed',
          checkout_id: accepted ? result.CheckoutRequestID : null,
          merchant_id: result.MerchantRequestID ?? null,
          error: accepted
            ? null
            : 'M-Pesa did not accept this payment request. Try again.',
        })
        .eq('id', purchase.id)
        .select('*')
        .single()
    ) as SmsPurchase
  } catch {
    return checked(
      await db
        .from('sms_purchases')
        .update({
          status: 'review',
          error:
            'The payment request was interrupted. Contact support before making another payment.',
        })
        .eq('id', purchase.id)
        .select('*')
        .single()
    ) as SmsPurchase
  }
}

// The callback is a notification, not proof of payment. An authenticated STK
// query verifies the exact checkout issued for our immutable price and bundle.
export async function verifySmsPurchase(
  purchase: SmsPurchase,
  receipt?: string
) {
  if (purchase.status === 'paid' && receipt && !purchase.receipt) {
    return checked(
      await communicationDb(createAdminClient()).rpc('confirm_sms_purchase', {
        p_id: purchase.id,
        p_checkout: purchase.checkout_id,
        p_receipt: receipt,
      })
    ) as SmsPurchase
  }
  if (
    purchase.status === 'paid' ||
    purchase.status === 'failed' ||
    !purchase.checkout_id
  )
    return purchase
  if (purchase.environment !== smsEnvironment())
    throw new CommunicationError(
      'This payment belongs to a different SMS environment'
    )
  const result = await mpesaRequest(
    '/mpesa/stkpushquery/v1/query',
    { ...password(), CheckoutRequestID: purchase.checkout_id },
    await token()
  )
  const db = communicationDb(createAdminClient())
  if (
    String(result.ResponseCode) === '0' &&
    String(result.ResultCode) === '0'
  ) {
    return checked(
      await db.rpc('confirm_sms_purchase', {
        p_id: purchase.id,
        p_checkout: purchase.checkout_id,
        p_receipt: receipt ?? null,
      })
    ) as SmsPurchase
  }
  // Only a completed, explicit failure can close a pending purchase. Transport
  // errors and "still processing" responses remain eligible for reconciliation.
  if (
    String(result.ResponseCode) === '0' &&
    result.ResultCode != null &&
    String(result.ResultCode) !== '0'
  ) {
    return (
      (checked(
        await db
          .from('sms_purchases')
          .update({
            status: 'failed',
            error:
              'M-Pesa payment was not completed. No SMS credits were added.',
          })
          .eq('id', purchase.id)
          .in('status', ['pending', 'review'])
          .select('*')
          .maybeSingle()
      ) as SmsPurchase) ?? purchase
    )
  }
  return purchase
}
export async function reconcileSmsPurchases() {
  if (!smsPurchaseConfiguration().enabled) return { checked: 0 }
  const db = communicationDb(createAdminClient())
  const pending = checked(
    await db
      .from('sms_purchases')
      .select('*')
      .eq('environment', smsEnvironment())
      .in('status', ['pending', 'review'])
      .not('checkout_id', 'is', null)
      .order('created_at')
      .limit(5)
  ) as SmsPurchase[]
  let confirmed = 0
  for (const purchase of pending) {
    try {
      if ((await verifySmsPurchase(purchase)).status === 'paid') confirmed++
    } catch {
      /* Next cron or the buyer can query again. */
    }
  }
  return { checked: pending.length, confirmed }
}
