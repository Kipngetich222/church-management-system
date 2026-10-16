import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents, getChurchEventStats } from '@/lib/services/events.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BackLink } from '@/components/shared/BackLink'
import { formatEventDate } from '@/lib/utils/date'
import { ChevronRight, Ticket } from 'lucide-react'

export default async function EventBookingsPage() {
  const { churchId } = await getActiveChurch()
  const [events, stats] = await Promise.all([
    listEvents(churchId),
    getChurchEventStats(churchId),
  ])

  const now = new Date().getTime()
  // Completed events are no longer open for booking and are kept out of this
  // view entirely so it only shows events that can still be booked.
  const bookingEvents = events.filter(
    (e) => e.is_registration_required && e.status !== 'completed'
  )
  const openEvents = bookingEvents.filter(
    (e) =>
      e.status === 'published' &&
      new Date(e.start_time).getTime() >= now &&
      (!e.registration_deadline ||
        new Date(e.registration_deadline).getTime() >= now)
  )

  return (
    <div className="space-y-6">
      <BackLink href="/admin/events" label="Events" />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ticket className="h-6 w-6" /> Event bookings
        </h1>
        <p className="text-sm text-muted-foreground">
          {bookingEvents.length} event{bookingEvents.length !== 1 ? 's' : ''} with
          registration · {openEvents.length} currently open for booking. Select an
          event to see everyone who booked.
        </p>
      </div>

      {bookingEvents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events require registration yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bookingEvents.map((e) => {
            const s = stats[e.id]
            const isOpen =
              e.status === 'published' &&
              new Date(e.start_time).getTime() >= now &&
              (!e.registration_deadline ||
                new Date(e.registration_deadline).getTime() >= now)
            return (
              <Link key={e.id} href={`/admin/events/bookings/${e.id}`}>
                <Card className="h-full transition hover:bg-muted/40">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{e.title}</span>
                        <Badge variant={isOpen ? 'default' : 'secondary'}>
                          {isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatEventDate(e.start_time, e.end_time, e.all_day)}
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{s?.booked ?? 0}</span>{' '}
                        <span className="text-muted-foreground">
                          booked{s && s.paid > 0 ? ` · ${s.paid} paid` : ''}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
