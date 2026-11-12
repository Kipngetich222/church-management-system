export const GIVING_TYPES = [
  'general',
  'tithe',
  'missions',
  'building_fund',
  'project_fund',
  'thanksgiving',
  'welfare',
  'other',
  'pledge',
] as const
export type GivingType = (typeof GIVING_TYPES)[number]
export const GIVING_LABELS: Record<GivingType, string> = {
  general: 'Offering',
  tithe: 'Tithe',
  missions: 'Mission',
  building_fund: 'Building fund',
  project_fund: 'Project fund',
  thanksgiving: 'Thanksgiving',
  welfare: 'Compassion',
  other: 'Other',
  pledge: 'Pledge payment',
}
export const DESTINATION_TYPES = ['paybill', 'till', 'pochi', 'phone'] as const
export type DestinationType = (typeof DESTINATION_TYPES)[number]
export const DESTINATION_LABELS: Record<DestinationType, string> = {
  paybill: 'Paybill',
  till: 'Buy goods till',
  pochi: 'Pochi la Biashara',
  phone: 'Mobile number',
}
export const MAX_GIVING_AMOUNT = 250_000
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const PENDING_STATUSES = ['initiating', 'pending', 'review'] as const
export const HISTORY_STATUSES = [
  'completed',
  'test',
  'pending',
  'failed',
  'review',
] as const

export class GivingError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = 'GivingError'
  }
}

export function givingLabel(type: string) {
  return GIVING_LABELS[type as GivingType] ?? type.replaceAll('_', ' ')
}

/** STK collection is only supported for Kenyan M-Pesa numbers. */
export function givingPhone(input: string): string | null {
  const value = input.trim().replace(/[\s()-]/g, '')
  if (/^(?:\+?254|0)[17]\d{8}$/.test(value))
    return value.replace(/^\+/, '').replace(/^0/, '254')
  if (/^[17]\d{8}$/.test(value)) return `254${value}`
  return null
}

export type GivingInput = {
  churchId: string
  requestId: string
  amount: number
  phone: string
  type: GivingType
}
export function validateGiving(input: GivingInput): GivingInput {
  if (!UUID_PATTERN.test(input.churchId) || !UUID_PATTERN.test(input.requestId))
    throw new GivingError('A valid church and payment request are required.')
  if (
    !Number.isInteger(input.amount) ||
    input.amount < 1 ||
    input.amount > MAX_GIVING_AMOUNT
  )
    throw new GivingError(
      `Enter a whole-shilling amount between KES 1 and KES ${MAX_GIVING_AMOUNT.toLocaleString('en-KE')}.`
    )
  const phone =
    typeof input.phone === 'string' ? givingPhone(input.phone) : null
  if (!phone)
    throw new GivingError(
      'Enter a Kenyan M-Pesa number, for example 0712 345 678.'
    )
  if (!GIVING_TYPES.includes(input.type))
    throw new GivingError('Select a valid giving type.')
  return { ...input, phone }
}

export type GivingSettingsInput = {
  enabled: boolean
  destinationType: DestinationType
  destinationNumber: string
  accountReference: string
  businessShortCode: string
  environment: 'sandbox' | 'production'
  consumerKey?: string
  consumerSecret?: string
  passkey?: string
}
export type GivingSettings = {
  church_id: string
  enabled: boolean
  destination_type: DestinationType
  destination_number: string
  account_reference: string
  business_shortcode: string
  environment: 'sandbox' | 'production'
  credentials_ciphertext: string | null
  updated_at: string
}
export type PublicGivingSettings = Omit<
  GivingSettings,
  'credentials_ciphertext'
> & {
  hasCredentials: boolean
  ready: boolean
  issues: string[]
}
export type GivingCredentials = {
  consumerKey: string
  consumerSecret: string
  passkey: string
}
export type ReceiptDetails = {
  church: {
    name: string
    logo_url?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
  }
  donor: { full_name: string; email?: string | null }
  phone?: string | null
  destination_type?: DestinationType | null
  destination_number?: string | null
  account_reference?: string | null
  environment?: 'sandbox' | 'production'
}
export type GivingPayment = {
  id: string
  church_id: string
  membership_id: string | null
  user_id: string | null
  request_id: string
  amount: number
  phone: string
  type: GivingType
  status: 'initiating' | 'pending' | 'succeeded' | 'failed' | 'review'
  environment: 'sandbox' | 'production'
  destination_type: DestinationType
  destination_number: string
  account_reference: string
  business_shortcode: string
  credentials_ciphertext: string
  callback_token_hash: string
  checkout_request_id: string | null
  merchant_request_id: string | null
  mpesa_receipt: string | null
  result_code: number | null
  error: string | null
  offering_id: string | null
  receipt_details: ReceiptDetails
  last_checked_at: string | null
  created_at: string
  confirmed_at: string | null
}
export type PublicGivingPayment = Pick<
  GivingPayment,
  | 'id'
  | 'church_id'
  | 'amount'
  | 'phone'
  | 'type'
  | 'status'
  | 'environment'
  | 'error'
  | 'offering_id'
  | 'created_at'
  | 'confirmed_at'
>
export function publicPayment(payment: GivingPayment): PublicGivingPayment {
  const {
    id,
    church_id,
    amount,
    phone,
    type,
    status,
    environment,
    error,
    offering_id,
    created_at,
    confirmed_at,
  } = payment
  return {
    id,
    church_id,
    amount,
    phone,
    type,
    status,
    environment,
    error,
    offering_id,
    created_at,
    confirmed_at,
  }
}
export type GivingHistoryRow = {
  id: string
  church_id: string
  membership_id: string | null
  payment_id: string | null
  offering_id: string | null
  amount: number
  currency: string
  type: GivingType
  method: string
  status: (typeof HISTORY_STATUSES)[number]
  reference: string | null
  receipt_number: string | null
  given_at: string
  created_at: string
  donor_name: string
  donor_email: string | null
  phone: string | null
  destination_type: DestinationType | null
  destination_number: string | null
  error: string | null
}
export type GivingHistoryFilters = {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  type?: string
  status?: string
}
export type GivingHistory = {
  rows: GivingHistoryRow[]
  total: number
  page: number
  pageSize: number
}

export type GivingTables = {
  church_giving_settings: {
    Row: GivingSettings & { updated_by: string | null }
    Insert: Pick<
      GivingSettings,
      'church_id' | 'destination_type' | 'destination_number'
    > &
      Partial<GivingSettings> & { updated_by?: string | null }
    Update: Partial<GivingSettings> & { updated_by?: string | null }
    Relationships: []
  }
  giving_payments: {
    Row: GivingPayment
    Insert: Pick<
      GivingPayment,
      | 'church_id'
      | 'request_id'
      | 'amount'
      | 'phone'
      | 'type'
      | 'environment'
      | 'destination_type'
      | 'destination_number'
      | 'account_reference'
      | 'business_shortcode'
      | 'credentials_ciphertext'
      | 'callback_token_hash'
      | 'receipt_details'
    > &
      Partial<GivingPayment>
    Update: Partial<GivingPayment>
    Relationships: []
  }
}

export function paymentFailure(code: number) {
  if (code === 1032)
    return 'The M-Pesa prompt was cancelled. You can try again.'
  if (code === 1037 || code === 1025)
    return 'The M-Pesa prompt expired or the phone could not be reached. You can try again.'
  if (code === 1)
    return 'M-Pesa could not complete the payment. Check your balance and try again.'
  return 'M-Pesa did not complete the payment. You can try again.'
}
