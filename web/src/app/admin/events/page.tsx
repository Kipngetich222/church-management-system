import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents, getChurchEventStats } from '@/lib/services/events.service'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { EventsTable } from '@/components/events/EventsTable'
import { BackLink } from '@/components/shared/BackLink'

export default async function AdminEventsPage() {
  const { churchId } = await getActiveChurch()
  const [events, stats] = await Promise.all([
    listEvents(churchId),
    getChurchEventStats(churchId),
  ])

  const now = new Date().getTime()
  const upcoming = events.filter(
    (e) => e.status === 'published' && new Date(e.start_time).getTime() >= now
  ).length
  const past = events.filter(
    (e) => e.status === 'completed' || new Date(e.start_time).getTime() < now
  ).length

  return (
    <div className="space-y-6">
      <BackLink href="/admin/dashboard" label="Dashboard" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming} upcoming · {past} past · {events.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/events/calendar">
              <CalendarDays className="h-4 w-4 mr-2" /> Calendar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/events/new">
              <Plus className="h-4 w-4 mr-2" /> New event
            </Link>
          </Button>
        </div>
      </div>
      <EventsTable events={events} stats={stats} />
    </div>
  )
}


