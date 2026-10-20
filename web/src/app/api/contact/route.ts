import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  renderContactNotificationEmail,
  renderContactNotificationText,
} from '@/lib/email/template'

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  church: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().min(1).max(4000),
})

const DEFAULT_CONTACT_EMAIL = 'victoryegon222@gmail.com'

function contactRecipients() {
  return (process.env.CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL)
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = contactSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { name, email, church, message } = parsed.data
  const to = contactRecipients()

  try {
    if (!process.env.RESEND_API_KEY) {
      console.error(
        'Contact form email is not configured: RESEND_API_KEY is missing'
      )
      return NextResponse.json(
        { error: 'Contact email is not configured. Please try again later.' },
        { status: 503 }
      )
    }

    const { sendEmail } = await import('@/lib/services/email.service')
    const notification = { name, email, church: church || undefined, message }
    const result = await sendEmail({
      to,
      replyTo: email,
      subject: `New enquiry from ${name}`,
      html: renderContactNotificationEmail(notification),
      text: renderContactNotificationText(notification),
      template: false,
    })

    if (result.error) {
      console.error('Failed to send contact email:', result.error)
      return NextResponse.json(
        { error: 'Could not send your message. Please try again later.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Failed to send contact email:', error)
    return NextResponse.json(
      { error: 'Could not send your message. Please try again later.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
