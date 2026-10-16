import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EyeOff } from 'lucide-react'

import { ServiceOccurrenceToggle } from './ServiceOccurrenceToggle'

export type HiddenServiceItem = {
  serviceId: string
  title: string
  date: string
  times: string
  reason: string | null
}

function formatDateKey(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Lists the single days that have been hidden from the calendars, with a
 * one-click restore for each. Hiding an occurrence also removes it from the
 * calendar, which made it hard to find again - this keeps them all in one place
 * under recurring services.
 */
export function HiddenRecurringServices({
  churchId,
  items,
}: {
  churchId: string
  items: HiddenServiceItem[]
}) {
  if (items.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="h-5 w-5" /> Hidden services
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Days you removed from the calendar. They are skipped everywhere, so
          restore them here to bring them back.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.serviceId}-${item.date}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 space-y-0.5">
              <Link
                href={`/admin/events/recurring/${item.serviceId}?date=${item.date}`}
                className="font-medium hover:underline"
              >
                {item.title}
              </Link>
              <div className="text-xs text-muted-foreground">
                {formatDateKey(item.date)}
                {item.times ? ` - ${item.times}` : ''}
              </div>
              {item.reason && (
                <div className="text-xs text-muted-foreground">
                  Reason: {item.reason}
                </div>
              )}
            </div>

            <ServiceOccurrenceToggle
              churchId={churchId}
              serviceId={item.serviceId}
              date={item.date}
              hidden
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
