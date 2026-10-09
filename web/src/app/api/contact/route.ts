import { NextResponse } from 'next/server'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  church: z.string().max(160).optional().or(z.literal('')),
  message: z.string().min(1).max(4000),
})

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = contactSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { name, email, church, message } = parsed.data
  const to = process.env.CONTACT_EMAIL ?? 'hello@yourchurch.app'

  try {
    if (process.env.RESEND_API_KEY) {
      const { sendEmail } = await import('@/lib/services/email.service')
      await sendEmail({
        to,
        subject: `New enquiry from ${name}`,
        html: `
          <h2>New contact form submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${church ? `<p><strong>Church:</strong> ${church}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br />')}</p>
        `,
      })
    } else {
      console.info('Contact form submission (email not configured):', {
        name,
        email,
        church,
        message,
      })
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
