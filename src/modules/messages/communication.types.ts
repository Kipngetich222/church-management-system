export type SmsEnvironment = 'sandbox' | 'production'
export type RecipientFilter = {
  type: 'all' | 'department' | 'group' | 'custom' | 'category' | 'leaders'
  ids: string[]
}
export type CampaignInput = {
  churchId: string
  channel: 'sms' | 'email' | 'in_app'
  body: string
  subject?: string
  recipientFilter: RecipientFilter
  scheduledAt?: string
  requestId: string
}
export type Campaign = {
  id: string
  church_id: string
  channel: CampaignInput['channel']
  body: string
  subject: string | null
  recipient_filter: RecipientFilter
  scheduled_at: string | null
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  sms_units: number
  sms_environment: SmsEnvironment
  created_by: string | null
  created_by_name: string
  source: string
  error: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
}
export type Recipient = {
  membership_id: string
  user_id: string | null
  name: string
  phone: string | null
  email: string | null
}
export type Message = {
  id: string
  membership_id: string | null
  recipient_name: string
  to_address: string
  status: string
  error: string | null
  provider_id: string | null
  sms_parts: number
  credit_state: string
  sent_at: string | null
  created_at: string
}
export type SmsSummary = {
  purchased: number
  available: number
  used: number
  reserved: number
  breakdown: { actor: string; units: number; messages: number }[]
}

// GSM-7 extension characters consume two septets. UCS-2 counts UTF-16 units,
// including both halves of emoji; multipart headers reduce each part's limit.
const gsmBasic = new Set(
  Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
  )
)
const gsmExtended = new Set(Array.from('\f^{}\\[~]|€'))
export function smsSegments(body: string): number {
  if (!body.length) return 0
  let septets = 0
  for (const character of Array.from(body)) {
    if (gsmBasic.has(character)) septets++
    else if (gsmExtended.has(character)) septets += 2
    else return body.length <= 70 ? 1 : Math.ceil(body.length / 67)
  }
  return septets <= 160 ? 1 : Math.ceil(septets / 153)
}

export class CommunicationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
  }
}

export function validateCampaign(input: CampaignInput) {
  if (!['sms', 'email', 'in_app'].includes(input.channel))
    throw new CommunicationError('Invalid message channel')
  if (!input.body?.trim() || input.body.length > 1600)
    throw new CommunicationError('Write a message of 1–1,600 characters')
  const filter = input.recipientFilter
  if (
    !filter ||
    !['all', 'department', 'group', 'custom', 'category', 'leaders'].includes(
      filter.type
    ) ||
    !Array.isArray(filter.ids)
  )
    throw new CommunicationError('Invalid recipient filter')
  if (
    filter.ids.length > 10000 ||
    filter.ids.some((id) => typeof id !== 'string' || !id.trim())
  ) {
    throw new CommunicationError('Invalid recipient selection')
  }
  if (
    ['department', 'group', 'custom', 'category'].includes(filter.type) &&
    !filter.ids.length
  )
    throw new CommunicationError('Select at least one recipient option')
  if (
    filter.type === 'category' &&
    filter.ids.some((id) => !['men', 'women', 'youth', 'children'].includes(id))
  )
    throw new CommunicationError('Invalid member category')
  if (
    input.scheduledAt &&
    (!/(Z|[+-]\d{2}:\d{2})$/.test(input.scheduledAt) ||
      !Number.isFinite(Date.parse(input.scheduledAt)) ||
      Date.parse(input.scheduledAt) <= Date.now())
  )
    throw new CommunicationError(
      'Choose a future date and time, including its time zone'
    )
}
