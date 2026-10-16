import Link from 'next/link'
import { isToday } from 'date-fns'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, Clock, MapPin, Repeat } from 'lucide-react'

import type { RecurringServiceRow, ServiceTime } from '@/lib/constants/services'
import { nextOccurrences } from '@/lib/utils/recurrence'

/** Show the first occurrence (the "next" service) plus a few that follow. */
const WIDGET_LIMIT = 4

function formatTimes(times: ServiceTime[]): string {
  if (!Array.isArray(times) || times.length === 0) return 'Time to be announced'
  return times
    .map((t) => (t.label ? `${t.label} ${t.start}` : t.start))
    .join(' - ')
}

function formatDay(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  if (isToday(date)) return 'Today'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Member dashboard widget: the next (or current) recurring service together
 * with what comes after it, so members can jump straight to a programme without
 * hunting through the calendar.
 */
export function UpcomingServices({
  services,
  hidden,
}: {
  services: RecurringServiceRow[]
  hidden?: Set<string>
}) {
  const upcoming = nextOccurrences(services, WIDGET_LIMIT, undefined, hidden)
  const byId = new Map(services.map((service) => [service.id, service]))
  const [next, ...following] = upcoming
  const nextService = next ? byId.get(next.serviceId) : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5" /> Services
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {!next || !nextService ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No services scheduled yet.
          </p>
        ) : (
          <>
            <div className="rounded-lg border bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                {isToday(new Date(`${next.date}T00:00:00`))
                  ? 'Happening today'
                  : 'Next service'}
              </div>

              <div className="font-semibold text-lg">{next.title}</div>

              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> {formatDay(next.date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {formatTimes(next.times)}
                </span>
                {nextService.location_name && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {nextService.location_name}
                  </span>
                )}
              </div>

              <Button asChild size="sm" className="mt-1">
                <Link
                  href={`/member/services/${next.serviceId}?date=${next.date}`}
                >
                  Programme &amp; details
                </Link>
              </Button>
            </div>

            {following.length > 0 && (
              <div className="space-y-1">
                {following.map((occurrence) => (
                  <Link
                    key={`${occurrence.serviceId}-${occurrence.date}`}
                    href={`/member/services/${occurrence.serviceId}?date=${occurrence.date}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {occurrence.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDay(occurrence.date)} - {formatTimes(occurrence.times)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
