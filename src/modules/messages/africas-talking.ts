import { CommunicationError, type SmsEnvironment } from './communication.types'

export type SmsProviderRecipient = {
  number: string
  status: string
  statusCode?: number
  messageId?: string
  cost?: string
}
export type SmsProviderResult = {
  SMSMessageData: { Recipients: SmsProviderRecipient[] }
}
export type SmsProviderConfig = {
  username?: string
  apiKey?: string
  senderId?: string
  environment: SmsEnvironment
}

export function requireSmsConfig(config: SmsProviderConfig) {
  if (!config.username || !config.apiKey)
    throw new CommunicationError(
      'SMS sending is not configured. Contact the platform administrator.',
      503
    )
}

export async function sendAfricasTalking(
  config: SmsProviderConfig,
  to: string[],
  message: string
): Promise<SmsProviderResult> {
  requireSmsConfig(config)
  const host =
    config.environment === 'production'
      ? 'api.africastalking.com'
      : 'api.sandbox.africastalking.com'
  const body = new URLSearchParams({
    username: config.username!,
    to: to.join(','),
    message,
    bulkSMSMode: '1',
  })
  if (config.senderId) body.set('from', config.senderId)
  // A transport timeout is an unknown outcome, never an automatic resend.
  const response = await fetch(`https://${host}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey: config.apiKey!,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok)
    throw new Error(
      `SMS provider returned HTTP ${response.status}; delivery needs review`
    )
  const result = (await response.json()) as SmsProviderResult
  if (!Array.isArray(result?.SMSMessageData?.Recipients))
    throw new Error(
      'SMS provider returned an incomplete response; delivery needs review'
    )
  return result
}
