import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents } from '@/lib/services/events.service'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EventsTable } from '@/components/events/EventsTable'

export default async function AdminEventsPage() {
  const { churchId } = await getActiveChurch()
  const events = await listEvents(churchId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4 mr-2" /> New event
          </Link>
        </Button>
      </div>
      <EventsTable events={events} />
    </div>
  )
}