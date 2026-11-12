import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_SMS_CREDIT_PRICE_KES,
  SMS_BUNDLES,
  smsBundleAmount,
  smsPaymentPhone,
} from '@/lib/sms-purchase'
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
function configuredValue(key: string) {
  const value = process.env[key]?.trim()
  return Boolean(value && !/^(your(?:[-_ ]|$)|replace|changeme|<)/i.test(value))
}

function mpesaConfigurationIssues() {
  const issues: string[] = []
  if (
    ![
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET',
      'MPESA_SHORTCODE',
      'MPESA_PASSKEY',
    ].every(configuredValue)
  )
    issues.push('M-Pesa credentials are missing or still contain placeholders.')
  if (!/^\d{5,7}$/.test(process.env.MPESA_SHORTCODE?.trim() || ''))
    issues.push('A valid M-Pesa business shortcode is required.')
  if (!['sandbox', 'production'].includes(process.env.MPESA_ENV || ''))
    issues.push('The M-Pesa environment must be set to sandbox or production.')
  if (process.env.MPESA_ENV !== smsEnvironment())
    issues.push('M-Pesa and SMS must both use test mode or both use live mode.')
  return issues
}

function paymentCallbackBase() {
  try {
    const url = new URL(appBaseUrl().trim())
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !url.hostname.includes('.') ||
      /(^|\.)(localhost|local|internal)$/.test(url.hostname) ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(
        url.hostname
      )
    )
      return null
    return url.origin
  } catch {
    return null
  }
}

export function smsPurchaseConfiguration() {
  const override = process.env.SMS_CREDIT_PRICE_KES?.trim()
  const price = Number(override || DEFAULT_SMS_CREDIT_PRICE_KES)
  const validPrice =
    Number.isFinite(price) &&
    price >= 0.000001 &&
    smsBundleAmount(5000, price) <= 2147483647
  const unitPrice = validPrice ? price : null
  const issues = mpesaConfigurationIssues()
  if (
    !['AFRICAS_TALKING_API_KEY', 'AFRICAS_TALKING_USERNAME'].every(
      configuredValue
    )
  )
    issues.push(
      'SMS provider credentials are missing or still contain placeholders.'
    )
  if (
    !['sandbox', 'production'].includes(process.env.AFRICAS_TALKING_ENV || '')
  )
    issues.push('The SMS environment must be set to sandbox or production.')
  if (
    configuredValue('AFRICAS_TALKING_USERNAME') &&
    (process.env.AFRICAS_TALKING_USERNAME?.trim() === 'sandbox') !==
      (smsEnvironment() === 'sandbox')
  )
    issues.push(
      'The SMS username must match the selected test or live environment.'
    )
  if (
    !configuredValue('SMS_PAYMENT_CALLBACK_SECRET') ||
    (process.env.SMS_PAYMENT_CALLBACK_SECRET?.trim().length ?? 0) < 32
  )
    issues.push('A secure payment confirmation secret is required.')
  if (!paymentCallbackBase())
    issues.push(
      'A public HTTPS app address is required for payment confirmation.'
    )
  if (
    !['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'].includes(
      process.env.MPESA_TRANSACTION_TYPE?.trim() || 'CustomerPayBillOnline'
    )
  )
    issues.push('The M-Pesa transaction type must match the business account.')
  if (
    process.env.MPESA_PARTY_B &&
    !/^\d{5,7}$/.test(process.env.MPESA_PARTY_B.trim())
  )
    issues.push('A valid M-Pesa receiving till or paybill number is required.')
  if (!validPrice) issues.push('The configured SMS price is invalid.')
  return {
    enabled: issues.length === 0,
    issues,
    unitPrice,
    pricingSource: override
      ? ('custom' as const)
      : ('africas-talking-basic' as const),
    bundles:
      unitPrice === null
        ? []
        : SMS_BUNDLES.map((credits) => ({
            credits,
            amountKes: smsBundleAmount(credits, unitPrice),
          })),
    environment: smsEnvironment(),
  }
}
function paymentConfig() {
  const config = smsPurchaseConfiguration()
  if (!config.enabled)
    throw new CommunicationError(
      `SMS purchasing is not configured. ${config.issues.join(' ')}`,
      503
    )
  return config
}
function mpesaBase() {
  // An issued checkout must remain verifiable even if SMS sending or selling
  // prices are subsequently disabled or changed.
  if (mpesaConfigurationIssues().length)
    throw new CommunicationError(
      'M-Pesa payment verification is not configured.',
      503
    )
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'
}
function password() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14)
  return {
    Timestamp: timestamp,
    Password: Buffer.from(
      `${process.env.MPESA_SHORTCODE!.trim()}${process.env.MPESA_PASSKEY!.trim()}${timestamp}`
    ).toString('base64'),
    BusinessShortCode: process.env.MPESA_SHORTCODE!.trim(),
  }
}
async function token() {
  const response = await fetch(
    `${mpesaBase()}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.MPESA_CONSUMER_KEY!.trim()}:${process.env.MPESA_CONSUMER_SECRET!.trim()}`).toString('base64')}`,
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
class MpesaRequestRejected extends CommunicationError {}

async function mpesaRequest(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
) {
  const response = await fetch(`${mpesaBase()}${path}`, {
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
  if (
    response.status >= 400 &&
    response.status < 500 &&
    typeof data?.errorCode === 'string'
  ) {
    console.warn('M-Pesa rejected SMS request', {
      status: response.status,
      code: data.errorCode,
    })
    throw new MpesaRequestRejected(
      response.status === 401 || response.status === 403
        ? 'M-Pesa rejected the payment credentials. Contact your platform administrator.'
        : 'M-Pesa rejected this request. Check the phone number and try again. If this continues, contact your platform administrator.',
      503
    )
  }
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
    quotedAmountKes?: number
  },
  userId: string,
  name: string
) {
  const config = paymentConfig()
  if (!SMS_BUNDLES.some((credits) => credits === input.credits))
    throw new CommunicationError('Select a valid SMS bundle')
  const phone = smsPaymentPhone(input.phone)
  if (!phone) throw new CommunicationError('Enter a valid Kenyan M-Pesa number')
  const db = communicationDb(createAdminClient())
  const existing = checked(
    await db
      .from('sms_purchases')
      .select('*')
      .eq('church_id', input.churchId)
      .eq('request_id', input.requestId)
      .maybeSingle()
  ) as SmsPurchase | null
  if (existing) {
    if (existing.environment !== config.environment)
      throw new CommunicationError(
        'This request belongs to a different SMS environment',
        409
      )
    return existing
  }
  if (
    input.quotedAmountKes !== undefined &&
    input.quotedAmountKes !== smsBundleAmount(input.credits, config.unitPrice!)
  )
    throw new CommunicationError(
      'The bundle price has changed. Refresh the page and confirm the updated total.',
      409
    )
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
      amount_kes: smsBundleAmount(input.credits, config.unitPrice!),
      phone,
      created_by: userId,
      created_by_name: name,
    })
    .select('*')
    .single()
  if (inserted.error?.code === '23505') {
    // The same request may have completed while this insert was in flight.
    const repeated = checked(
      await db
        .from('sms_purchases')
        .select('*')
        .eq('church_id', input.churchId)
        .eq('request_id', input.requestId)
        .maybeSingle()
    ) as SmsPurchase | null
    if (repeated?.environment === config.environment) return repeated
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
  async function updateInitiating(changes: Record<string, unknown>) {
    const updated = checked(
      await db
        .from('sms_purchases')
        .update(changes)
        .eq('id', purchase.id)
        .eq('status', 'initiating')
        .select('*')
        .maybeSingle()
    )
    // The save may have committed before its HTTP response was lost. A
    // callback may even have confirmed it already; never regress that state.
    return (updated ??
      checked(
        await db
          .from('sms_purchases')
          .select('*')
          .eq('id', purchase.id)
          .single()
      )) as SmsPurchase
  }
  let checkout: { checkout_id: string; merchant_id: string | null } | undefined
  try {
    const result = await mpesaRequest(
      '/mpesa/stkpush/v1/processrequest',
      {
        ...password(),
        TransactionType:
          process.env.MPESA_TRANSACTION_TYPE?.trim() || 'CustomerPayBillOnline',
        Amount: purchase.amount_kes,
        PartyA: phone,
        PartyB:
          process.env.MPESA_PARTY_B?.trim() ||
          process.env.MPESA_SHORTCODE!.trim(),
        PhoneNumber: phone,
        CallBackURL: `${paymentCallbackBase()}/api/sms/purchases/callback?id=${purchase.id}&token=${paymentCallbackToken(purchase.id)}`,
        AccountReference: `SMS${purchase.id.replace(/-/g, '').slice(0, 9)}`,
        TransactionDesc: 'SMS credits',
      },
      accessToken
    )
    const accepted =
      String(result.ResponseCode) === '0' &&
      typeof result.CheckoutRequestID === 'string' &&
      result.CheckoutRequestID.trim().length > 0
    if (accepted)
      checkout = {
        checkout_id: result.CheckoutRequestID,
        merchant_id: result.MerchantRequestID ?? null,
      }
    const rejected =
      !accepted &&
      ((result.ResponseCode != null && String(result.ResponseCode) !== '0') ||
        typeof result.errorCode === 'string')
    if (!accepted && !rejected) throw new Error('Incomplete STK response')
    return await updateInitiating({
      status: accepted ? 'pending' : 'failed',
      checkout_id: accepted ? result.CheckoutRequestID : null,
      merchant_id: result.MerchantRequestID ?? null,
      error: accepted
        ? null
        : 'M-Pesa did not accept this payment request. Try again.',
    })
  } catch (error) {
    const rejected = error instanceof MpesaRequestRejected
    return updateInitiating({
      ...checkout,
      status: rejected ? 'failed' : 'review',
      error: rejected
        ? error.message
        : checkout
          ? 'The payment prompt was requested, but confirmation was interrupted. Check payment status shortly.'
          : 'The payment request was interrupted. Contact support before making another payment.',
    })
  }
}

// The callback is a notification, not proof of payment. An authenticated STK
// query verifies the exact checkout issued for our immutable price and bundle.
export async function verifySmsPurchase(
  purchase: SmsPurchase,
  receipt?: string
) {
  if (purchase.environment !== smsEnvironment())
    throw new CommunicationError(
      'This payment belongs to a different SMS environment'
    )
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
  const result = await mpesaRequest(
    '/mpesa/stkpushquery/v1/query',
    { ...password(), CheckoutRequestID: purchase.checkout_id },
    await token()
  )
  const db = communicationDb(createAdminClient())
  // Daraja echoes the checkout. Never settle from an incomplete or mismatched
  // query result, even when it contains a success code.
  if (result.CheckoutRequestID !== purchase.checkout_id) return purchase
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
              String(result.ResultCode) === '1032'
                ? 'The M-Pesa prompt was cancelled. You can try again.'
                : ['1037', '1025'].includes(String(result.ResultCode))
                  ? 'The M-Pesa prompt expired or your phone could not be reached. Check your phone and try again.'
                  : 'M-Pesa payment was not completed. No SMS credits were added. You can try again.',
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
  if (mpesaConfigurationIssues().length) return { checked: 0 }
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
