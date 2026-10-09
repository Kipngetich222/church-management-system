import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents, getUpcomingPublicEvents } from '@/lib/services/events.service'
import { CalendarView } from '@/components/events/CalendarView'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'

export default async function MemberCalendarPage() {
  const { churchId } = await getActiveChurch()
  const events = await listEvents(churchId)
  const upcoming = await getUpcomingPublicEvents(churchId, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendar</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <CalendarView events={events} basePath="/member/events" />
        <UpcomingEvents events={upcoming} basePath="/member/events" />
      </div>
    </div>
  )
}