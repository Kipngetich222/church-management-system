import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents } from '@/lib/services/events.service'
import { listRecurringServices } from '@/lib/services/recurring-services.service'
import { expandManyOccurrences, toDateKey } from '@/lib/utils/recurrence'
import { CalendarView } from '@/components/events/CalendarView'
import { BackLink } from '@/components/shared/BackLink'
import { Button } from '@/components/ui/button'
import { Repeat } from 'lucide-react'

export default async function AdminEventCalendarPage() {
  const { churchId } = await getActiveChurch()
  const [events, services] = await Promise.all([
    listEvents(churchId),
    listRecurringServices(churchId),
  ])

  // Expand recurring services across a wide window so month navigation always
  // has something to show.
  const from = new Date()
  from.setMonth(from.getMonth() - 3)
  const to = new Date()
  to.setMonth(to.getMonth() + 12)
  const occurrences = expandManyOccurrences(
    services,
    toDateKey(from),
    toDateKey(to)
  ).map((o) => ({
    id: o.serviceId,
    title: o.title,
    date: o.date,
    href: `/admin/events/recurring/${o.serviceId}?date=${o.date}`,
    subtitle: o.times.map((t) => t.start).join(', '),
  }))

  return (
    <div className="space-y-6">
      <BackLink href="/admin/events" label="Events" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Event calendar</h1>
          <p className="text-sm text-muted-foreground">
            Recurring services (amber) fill in automatically.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/events/recurring">
            <Repeat className="h-4 w-4 mr-2" /> Recurring services
          </Link>
        </Button>
      </div>

      <CalendarView events={events} occurrences={occurrences} />
    </div>
  )
}
