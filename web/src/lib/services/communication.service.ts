import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneForSms } from '@/lib/phone'
import { sendEmail } from '@/lib/services/email.service'
import {
  CommunicationEngine,
  communicationDb,
} from '../../../../src/modules/messages/communication-engine'
import {
  requireSmsConfig,
  sendAfricasTalking,
} from '../../../../src/modules/messages/africas-talking'

export function smsEnvironment() {
  return process.env.AFRICAS_TALKING_ENV === 'production'
    ? ('production' as const)
    : ('sandbox' as const)
}
export function communicationEngine() {
  const config = {
    username: process.env.AFRICAS_TALKING_USERNAME,
    apiKey: process.env.AFRICAS_TALKING_API_KEY,
    senderId: process.env.AFRICAS_TALKING_SENDER_ID,
    environment: smsEnvironment(),
  }
  return new CommunicationEngine(communicationDb(createAdminClient()), {
    environment: config.environment,
    normalizePhone: normalizePhoneForSms,
    ensureSmsConfigured: () => requireSmsConfig(config),
    sendSms: (to, body) => sendAfricasTalking(config, to, body),
    sendEmail: async (to, subject, body) => {
      if (!process.env.RESEND_API_KEY)
        throw new Error('Email sending is not configured')
      const html = body
        .replace(
          /[&<>"']/g,
          (char) =>
            ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            })[char]!
        )
        .replace(/\n/g, '<br />')
      const result = await sendEmail({ to, subject, html, text: body })
      if (result.error) throw new Error(result.error.message)
    },
  })
}
