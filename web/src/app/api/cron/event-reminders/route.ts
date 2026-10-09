import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendSms, normalizePhone } from '@/lib/services/sms.service'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { data: events } = await admin
    .from('events')
    .select('id, title, start_time, location_name, church_id')
    .eq('status', 'published')
    .gte('start_time', now.toISOString())
    .lte('start_time', in24h.toISOString())

  let totalSent = 0

  for (const event of events ?? []) {
    const { data: members } = await admin
      .from('church_memberships')
      .select('id, users!inner(phone)')
      .eq('church_id', event.church_id)

    const phones = (members ?? [])
      .map((m: any) => m.users?.phone)
      .filter(Boolean)
      .map((p: string) => normalizePhone(p))

    if (!phones.length) continue

    const time = new Date(event.start_time).toLocaleString('en-KE', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })

    const message = `Reminder: ${event.title} is tomorrow at ${time}${
      event.location_name ? ` at ${event.location_name}` : ''
    }.`

    const result = await sendSms({ to: phones, message })

    await admin.from('message_campaigns').insert({
      church_id: event.church_id,
      channel: 'sms',
      body: message,
      recipient_filter: { type: 'event_reminder', ids: [event.id] },
      status: 'sent',
      total_recipients: phones.length,
      sent_count: phones.length,
      sent_at: new Date().toISOString(),
    })

    totalSent += phones.length
  }

  return NextResponse.json({ ok: true, events: events?.length ?? 0, sent: totalSent })
}