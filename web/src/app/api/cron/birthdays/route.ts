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

  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()

  const { data: members } = await admin
    .from('church_memberships')
    .select('id, church_id, users!inner(full_name, phone), churches(name)')
    .not('date_of_birth', 'is', null)

  const todayBirthdays = (members ?? []).filter((m: any) => {
    if (!m.date_of_birth) return false
    const dob = new Date(m.date_of_birth)
    return dob.getMonth() + 1 === month && dob.getDate() === day
  })

  let sent = 0
  for (const m of todayBirthdays as any[]) {
    if (!m.users?.phone) continue
    const message = `Happy birthday, ${m.users.full_name}! 🎉 ${m.churches.name} celebrates you today.`
    await sendSms({ to: normalizePhone(m.users.phone), message })
    sent++
  }

  return NextResponse.json({ ok: true, birthdays: todayBirthdays.length, sent })
}