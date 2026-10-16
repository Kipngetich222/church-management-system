import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import {
  listEvents,
  getChurchEventStats,
} from '@/lib/services/events.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, ChevronRight, Plus, Repeat, Ticket, UserCheck } from 'lucide-react'
import { EventsTable } from '@/components/events/EventsTable'
import { BackLink } from '@/components/shared/BackLink'

function StatLink({
  href,
  label,
  value,
  hint,
  icon: Icon,
}: {
  href: string
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition hover:bg-muted/40">
        <CardContent className="pt-4 flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold leading-tight">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}

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

  const totalConfirmed = Object.values(stats).reduce(
    (s, v) => s + Math.max(v.confirmed, v.attendance),
    0
  )
  // Only count bookings for events that are upcoming and still open for
  // registration, so the number reflects what members can actually book.
  const eventsOpenForBooking = events.filter(
    (e) =>
      e.is_registration_required &&
      e.status === 'published' &&
      new Date(e.start_time).getTime() >= now &&
      (!e.registration_deadline ||
        new Date(e.registration_deadline).getTime() >= now)
  )
  const totalBooked = eventsOpenForBooking.reduce(
    (sum, e) => sum + (stats[e.id]?.booked ?? 0),
    0
  )
  const bookingEvents = eventsOpenForBooking.length

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
            <Link href="/admin/events/recurring">
              <Repeat className="h-4 w-4 mr-2" /> Recurring
            </Link>
          </Button>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <StatLink
          href="/admin/events/bookings"
          label="Event bookings"
          value={String(totalBooked)}
          hint={`across ${bookingEvents} event${bookingEvents !== 1 ? 's' : ''} open for booking`}
          icon={Ticket}
        />
        <StatLink
          href="/admin/events/attendance"
          label="Confirmed attendance"
          value={String(totalConfirmed)}
          hint="members checked in"
          icon={UserCheck}
        />
      </div>

      <EventsTable events={events} stats={stats} />
    </div>
  )
}
