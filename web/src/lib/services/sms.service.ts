const AT_API_URL =
  process.env.AFRICAS_TALKING_ENV === 'production'
    ? 'https://api.africastalking.com/version1/messaging'
    : 'https://api.sandbox.africastalking.com/version1/messaging'

export async function sendSms({
  to,
  message,
  senderId,
}: {
  to: string[] | string
  message: string
  senderId?: string
}) {
  const username = process.env.AFRICAS_TALKING_USERNAME!
  const apiKey = process.env.AFRICAS_TALKING_API_KEY!
  const from = senderId ?? process.env.AFRICAS_TALKING_SENDER_ID

  const params = new URLSearchParams()
  params.append('username', username)
  params.append('to', Array.isArray(to) ? to.join(',') : to)
  params.append('message', message)
  if (from) params.append('from', from)

  const res = await fetch(AT_API_URL, {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  })

  return res.json()
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('+')) return phone
  return `+${digits}`
}