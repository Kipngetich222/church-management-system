import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatEventDate } from '@/lib/utils/date'
import { MapPin, CalendarDays } from 'lucide-react'
import type { EventRow } from '@/lib/services/events.service'

export function UpcomingEvents({
  events,
  basePath = '/admin/events',
  title = 'Upcoming events',
}: {
  events: EventRow[]
  basePath?: string
  title?: string
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
            Nothing coming up.
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
                <div className="h-14 w-20 rounded bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatEventDate(e.start_time, e.end_time, e.all_day)}
                </div>
                {e.location_name && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {e.location_name}
                  </div>
                )}
              </div>
              {e.visibility === 'members_only' && (
                <Badge variant="secondary" className="text-xs">Members</Badge>
              )}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}