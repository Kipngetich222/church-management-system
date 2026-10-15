import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents } from '@/lib/services/events.service'
import { CalendarView } from '@/components/events/CalendarView'
import { BackLink } from '@/components/shared/BackLink'

export default async function AdminEventCalendarPage() {
  const { churchId } = await getActiveChurch()
  const events = await listEvents(churchId)
  return (
    <div className="space-y-6">
      <BackLink href="/admin/events" label="Events" />

      <h1 className="text-2xl font-bold">Event calendar</h1>
      <CalendarView events={events} />
    </div>
  )
}