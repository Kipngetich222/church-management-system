import { Resend } from 'resend'

// Construct the client lazily. `new Resend()` throws when the API key is
// missing, and this module is imported by code that runs on every request (the
// deletion helper is pulled into the shared church-scope resolver), so an eager
// construction would break unrelated pages whenever the key is unset.
let resend: Resend | null = null

function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

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
  return getResend().emails.send({ from, to, subject, html })
}
