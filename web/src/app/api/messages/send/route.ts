import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendSms, normalizePhone } from '@/lib/services/sms.service'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  churchId: z.string().uuid(),
  channel: z.enum(['sms', 'email']).default('sms'),
  subject: z.string().optional(),
  body: z.string().min(1),
  recipientFilter: z.object({
    type: z.enum(['all', 'department', 'group', 'custom']),
    ids: z.array(z.string()).optional().default([]),
  }),
  scheduledAt: z.string().optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  const input = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role, id')
    .eq('user_id', user.id)
    .eq('church_id', input.churchId)
    .single()

  if (!membership || !['super_admin', 'dept_admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Resolve recipients
  let query = admin
    .from('church_memberships')
    .select('id, users!inner(phone, email, full_name)')
    .eq('church_id', input.churchId)

  if (input.recipientFilter.type === 'department' && input.recipientFilter.ids?.length) {
    // Dept admins can only message their own departments
    const allowedDepts =
      membership.role === 'dept_admin'
        ? (
            await admin
              .from('department_members')
              .select('department_id')
              .eq('membership_id', membership.id)
              .eq('is_leader', true)
          ).data?.map((d: any) => d.department_id) ?? []
        : input.recipientFilter.ids

    const filteredDepts =
      membership.role === 'dept_admin'
        ? input.recipientFilter.ids.filter((id) => allowedDepts.includes(id))
        : input.recipientFilter.ids

    if (!filteredDepts.length) return NextResponse.json({ error: 'No allowed departments' }, { status: 403 })

    const { data: memberIds } = await admin
      .from('department_members')
      .select('membership_id')
      .in('department_id', filteredDepts)

    const ids = memberIds?.map((m) => m.membership_id) ?? []
    if (!ids.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })
    query = query.in('id', ids) as any
  } else if (input.recipientFilter.type === 'group' && input.recipientFilter.ids?.length) {
    const { data: memberIds } = await admin
      .from('small_group_members')
      .select('membership_id')
      .in('group_id', input.recipientFilter.ids)
    const ids = memberIds?.map((m) => m.membership_id) ?? []
    if (!ids.length) return NextResponse.json({ error: 'No recipients' }, { status: 400 })
    query = query.in('id', ids) as any
  } else if (input.recipientFilter.type === 'custom' && input.recipientFilter.ids?.length) {
    query = query.in('id', input.recipientFilter.ids) as any
  } else if (membership.role === 'dept_admin') {
    return NextResponse.json({ error: 'Dept admins can only message their departments' }, { status: 403 })
  }

  const { data: recipients } = await query

  // Create campaign record
  const { data: campaign } = await admin
    .from('message_campaigns')
    .insert({
      church_id: input.churchId,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      recipient_filter: input.recipientFilter,
      scheduled_at: input.scheduledAt ?? null,
      status: input.scheduledAt ? 'scheduled' : 'sending',
      total_recipients: recipients?.length ?? 0,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (!campaign) return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })

  // If scheduled, return without sending
  if (input.scheduledAt) {
    return NextResponse.json({ campaignId: campaign.id, scheduled: true })
  }

  // Send immediately (SMS only — email handled separately)
  if (input.channel === 'sms') {
    const phones: string[] = []
    const messageRows: any[] = []
    for (const r of recipients ?? []) {
      const phone = (r as any).users?.phone
      if (!phone) {
        messageRows.push({
          campaign_id: campaign.id,
          church_id: input.churchId,
          membership_id: r.id,
          channel: 'sms',
          to_address: 'unknown',
          body: input.body,
          status: 'failed',
          error: 'No phone number on file',
        })
        continue
      }
      const normalized = normalizePhone(phone)
      phones.push(normalized)
      messageRows.push({
        campaign_id: campaign.id,
        church_id: input.churchId,
        membership_id: r.id,
        channel: 'sms',
        to_address: normalized,
        body: input.body,
        status: 'sending',
      })
    }

    const { data: inserted } = await admin
      .from('messages')
      .insert(messageRows)
      .select('id, to_address')

    if (phones.length > 0) {
      const result = await sendSms({ to: phones, message: input.body })
      const atRecipients = result?.SMSMessageData?.Recipients ?? []

      // Match response to message rows
      for (const recip of atRecipients) {
        const match = inserted?.find((m) => m.to_address === recip.number)
        if (!match) continue
        await admin
          .from('messages')
          .update({
            status: recip.status === 'Success' ? 'sent' : 'failed',
            provider_id: recip.messageId,
            provider_response: recip,
            error: recip.status !== 'Success' ? recip.status : null,
            sent_at: new Date().toISOString(),
          })
          .eq('id', match.id)
      }
    }

    await admin
      .from('message_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: phones.length,
        failed_count: messageRows.filter((m) => m.status === 'failed').length,
      })
      .eq('id', campaign.id)
  }

  return NextResponse.json({ campaignId: campaign.id })
}