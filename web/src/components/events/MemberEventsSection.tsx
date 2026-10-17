'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'
import type { EventRow } from '@/lib/services/events.service'

export function MemberEventsSection({
  upcoming,
  past,
  basePath = '/member/events',
}: {
  upcoming: EventRow[]
  past: EventRow[]
  basePath?: string
}) {
  const [showPast, setShowPast] = useState(false)
  const hasPastEvents = past.length > 0

  return (
    <>
      <UpcomingEvents
        events={upcoming}
        basePath={basePath}
        title="Upcoming events"
        emptyText="Nothing coming up."
        action={
          hasPastEvents ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Show past events
              </span>
              <Switch
                checked={showPast}
                onCheckedChange={setShowPast}
                aria-label="Show past events"
              />
            </div>
          ) : undefined
        }
      />

      {showPast && hasPastEvents && (
        <UpcomingEvents
          events={past}
          basePath={basePath}
          title="Past events"
          emptyText="No past events yet."
        />
      )}
    </>
  )
}
