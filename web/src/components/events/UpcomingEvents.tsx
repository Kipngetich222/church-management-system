import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatEventDate } from '@/lib/utils/date'
import { MapPin, CalendarDays, Globe } from 'lucide-react'
import type { EventRow } from '@/lib/services/events.service'

export function UpcomingEvents({
  events,
  basePath = '/admin/events',
  title = 'Upcoming events',
  emptyText = 'Nothing coming up.',
}: {
  events: EventRow[]
  basePath?: string
  title?: string
  emptyText?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {emptyText}
          </p>
        ) : (
          events.map((e) => (
            <Link
              key={e.id}
              href={`${basePath}/${e.id}`}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition"
            >
              {e.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.poster_url} className="h-14 w-20 rounded object-cover shrink-0" alt="" />
              ) : (
                <div className="h-14 w-20 rounded bg-muted grid place-items-center shrink-0">
                  <CalendarDays className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatEventDate(e.start_time, e.end_time, e.all_day)}
                </div>
                {e.event_type === 'online' ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3" /> Online
                  </div>
                ) : (
                  e.location_name && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> {e.location_name}
                    </div>
                  )
                )}
              </div>
              {e.visibility !== 'public' && (
                <Badge variant="secondary" className="text-xs">Members</Badge>
              )}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
