import { checked, type CommunicationEngine } from './communication-engine'
import type { RecipientFilter } from './communication.types'

export async function runBirthdayMessages(engine: CommunicationEngine) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  let candidates = 0,
    sent = 0,
    failed = 0
  for (let offset = 0; ; offset += 1000) {
    const members =
      checked(
        await engine.db
          .from('church_memberships')
          .select('id,church_id,full_name,date_of_birth')
          .eq('status', 'active')
          .not('date_of_birth', 'is', null)
          .order('id')
          .range(offset, offset + 999)
      ) ?? []
    for (const member of members) {
      if (String(member.date_of_birth).slice(5, 10) !== today.slice(5, 10))
        continue
      candidates++
      try {
        const campaign = await engine.create(
          {
            churchId: member.church_id,
            channel: 'sms',
            body: `Happy birthday, ${member.full_name || 'friend'}! Blessings from your church family.`,
            recipientFilter: { type: 'custom', ids: [member.id] },
            requestId: `birthday:${engine.transport.environment}:${today}:${member.id}`,
          },
          null,
          'birthday'
        )
        sent += campaign.sent_count
      } catch {
        failed++
      }
    }
    if (members.length < 1000) break
  }
  return { candidates, sent, failed }
}

export async function runEventReminderMessages(engine: CommunicationEngine) {
  const now = new Date(),
    tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const events =
    checked(
      await engine.db
        .from('events')
        .select(
          'id,church_id,title,start_time,location_name,visibility,visibility_department_id,visibility_group_id'
        )
        .eq('status', 'published')
        .gte('start_time', now.toISOString())
        .lte('start_time', tomorrow.toISOString())
    ) ?? []
  let sent = 0,
    failed = 0
  for (const event of events) {
    let filter: RecipientFilter
    if (['public', 'all_members', 'members_only'].includes(event.visibility))
      filter = { type: 'all', ids: [] }
    else if (event.visibility === 'department')
      filter = {
        type: 'department',
        ids: event.visibility_department_id
          ? [event.visibility_department_id]
          : [],
      }
    else if (event.visibility === 'group')
      filter = {
        type: 'group',
        ids: event.visibility_group_id ? [event.visibility_group_id] : [],
      }
    else if (['men', 'women', 'youth'].includes(event.visibility))
      filter = { type: 'category', ids: [event.visibility] }
    else if (event.visibility === 'super_admins') {
      const admins =
        checked(
          await engine.db
            .from('church_memberships')
            .select('id')
            .eq('church_id', event.church_id)
            .eq('role', 'super_admin')
            .eq('status', 'active')
        ) ?? []
      filter = { type: 'custom', ids: admins.map((admin) => admin.id) }
    } else continue
    const time = new Date(event.start_time).toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    try {
      const campaign = await engine.create(
        {
          churchId: event.church_id,
          channel: 'sms',
          body: `Reminder: ${event.title} is on ${time} EAT${event.location_name ? ` at ${event.location_name}` : ''}.`,
          recipientFilter: filter,
          requestId: `event:${engine.transport.environment}:${event.id}:${event.start_time}`,
        },
        null,
        'event reminder'
      )
      sent += campaign.sent_count
    } catch {
      failed++
    }
  }
  return { events: events.length, sent, failed }
}
