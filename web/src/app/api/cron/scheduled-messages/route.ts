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
    let query = admin
      .from('church_memberships')
      .select('id, phone, users!church_memberships_user_id_fkey(phone)')
      .eq('church_id', campaign.church_id)

    if (filter?.type === 'department' && filter.ids?.length) {
      const { data: rows } = await admin
        .from('department_members')
        .select('membership_id')
        .in('department_id', filter.ids)
      const ids = (rows ?? []).map((row) => row.membership_id)
      if (!ids.length) {
        await admin
          .from('message_campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_count: 0,
          })
          .eq('id', campaign.id)
        continue
      }
      query = query.in('id', ids) as any
    } else if (filter?.type === 'group' && filter.ids?.length) {
      const { data: rows } = await admin
        .from('small_group_members')
        .select('membership_id')
        .in('group_id', filter.ids)
      const ids = (rows ?? []).map((row) => row.membership_id)
      if (!ids.length) {
        await admin
          .from('message_campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_count: 0,
          })
          .eq('id', campaign.id)
        continue
      }
      query = query.in('id', ids) as any
    } else if (filter?.type === 'custom' && filter.ids?.length) {
      query = query.in('id', filter.ids) as any
    }

    const { data: recipients } = await query

    const phones = (recipients ?? [])
      .map((r: any) => r.phone ?? r.users?.phone)
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
