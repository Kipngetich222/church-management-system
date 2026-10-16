import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents, listUpcomingEvents } from '@/lib/services/events.service'
import { CalendarView } from '@/components/events/CalendarView'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'
import { BackLink } from '@/components/shared/BackLink'

export default async function MemberCalendarPage() {
  const { churchId } = await getActiveChurch()
  const [events, upcoming] = await Promise.all([
    listEvents(churchId),
    listUpcomingEvents(churchId, 6),
  ])

  return (
    <div className="space-y-6">
      <BackLink href="/member/home" label="Home" />

      <h1 className="text-2xl font-bold">Calendar</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <CalendarView events={events} basePath="/member/events" />
        <UpcomingEvents
          events={upcoming}
          basePath="/member/events"
          emptyText="No upcoming events yet."
        />
      </div>
    </div>
  )
}
