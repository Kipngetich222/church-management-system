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

  const { data: due } = await admin
    .from('message_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  let sent = 0

  for (const campaign of due ?? []) {
    const filter = campaign.recipient_filter as any
    // Reuse logic: simple version sends to all — extend as needed
    const { data: recipients } = await admin
      .from('church_memberships')
      .select('id, users!inner(phone)')
      .eq('church_id', campaign.church_id)

    const phones = (recipients ?? [])
      .map((r: any) => r.users?.phone)
      .filter(Boolean)
      .map((p: string) => normalizePhone(p))

    if (phones.length) {
      const result = await sendSms({ to: phones, message: campaign.body })
      sent += phones.length
    }

    await admin
      .from('message_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: phones.length,
      })
      .eq('id', campaign.id)
  }

  return NextResponse.json({ ok: true, processed: due?.length ?? 0, sent })
}