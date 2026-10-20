import { NextResponse } from 'next/server'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  church: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().min(1).max(4000),
})

const DEFAULT_CONTACT_EMAIL = 'victoryegon222@gmail.com'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
    const result = await sendEmail({
      to,
      replyTo: email,
      subject: `New enquiry from ${name}`,
      html: `
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${church ? `<p><strong>Church:</strong> ${escapeHtml(church)}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
      `,
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
