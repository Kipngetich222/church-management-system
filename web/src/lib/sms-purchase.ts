import { isValidPhone, toMpesaPhone } from './phone'

export const SMS_BUNDLES = [100, 500, 1000, 5000] as const
// Africa's Talking Kenya Basic: KES 0.80 per part + 16% VAT.
// https://help.africastalking.com/en/articles/12381163-bulk-sms-kenya
export const DEFAULT_SMS_CREDIT_PRICE_KES = 0.928

export type SmsBundle = { credits: number; amountKes: number }

export function smsBundleAmount(credits: number, unitPrice: number) {
  // Calculate in millionths of a shilling before rounding for M-Pesa, so
  // floating point noise cannot add a shilling to an exact bundle total.
  return Math.ceil((credits * Math.round(unitPrice * 1_000_000)) / 1_000_000)
}

export function smsPaymentPhone(value: string): string | null {
  // Validate the complete input first: the general display normalizer clips
  // excess digits. M-Pesa always uses Kenya, regardless of the app default.
  if (!/^[+\d\s().-]+$/.test(value) || !isValidPhone(value, 'KE')) return null
  return toMpesaPhone(value, 'KE')
}
