import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents, listUpcomingEvents } from '@/lib/services/events.service'
import {
  listRecurringServices,
  listServiceExceptions,
} from '@/lib/services/recurring-services.service'
import {
  expandManyOccurrences,
  occurrenceKey,
  toDateKey,
} from '@/lib/utils/recurrence'
import { CalendarView } from '@/components/events/CalendarView'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'
import { BackLink } from '@/components/shared/BackLink'

export default async function MemberCalendarPage() {
  const { churchId } = await getActiveChurch()

  // Recurring services show on every matching day without being created as
  // individual events.
  const from = new Date()
  from.setMonth(from.getMonth() - 3)
  const to = new Date()
  to.setMonth(to.getMonth() + 12)
  const fromKey = toDateKey(from)
  const toKey = toDateKey(to)

  const [events, upcoming, services, exceptions] = await Promise.all([
    listEvents(churchId),
    listUpcomingEvents(churchId, 6),
    listRecurringServices(churchId),
    listServiceExceptions(churchId, fromKey, toKey),
  ])

  // Days an admin has hidden are skipped by the member calendar too.
  const hidden = new Set(
    exceptions.map((e) => occurrenceKey(e.recurring_service_id, e.service_date))
  )

  const occurrences = expandManyOccurrences(services, fromKey, toKey, hidden).map(
    (o) => ({
      id: o.serviceId,
      title: o.title,
      date: o.date,
      href: `/member/services/${o.serviceId}?date=${o.date}`,
      subtitle: o.times.map((t) => t.start).join(', '),
    })
  )

  return (
    <div className="space-y-6">
      <BackLink href="/member/home" label="Home" />

      <h1 className="text-2xl font-bold">Calendar</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <CalendarView
          events={events}
          occurrences={occurrences}
          basePath="/member/events"
        />
        <UpcomingEvents
          events={upcoming}
          basePath="/member/events"
          emptyText="No upcoming events yet."
        />
      </div>
    </div>
  )
}
