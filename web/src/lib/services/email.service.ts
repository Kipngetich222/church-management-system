import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.RESEND_FROM ?? 'noreply@yourchurch.app',
}: {
  to: string | string[]
  subject: string
  html: string
  from?: string
}) {
  return resend.emails.send({ from, to, subject, html })
}