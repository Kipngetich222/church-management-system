'use client'

import { useState } from 'react'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'
import { Switch } from '@/components/ui/switch'
import type { EventRow } from '@/lib/services/events.service'

/**
 * Admin dashboard event lists. Upcoming events are always shown; the past
 * events list can be tucked away so the dashboard stays focused on what is
 * coming up.
 */
export function DashboardEvents({
  upcoming,
  past,
}: {
  upcoming: EventRow[]
  past: EventRow[]
}) {
  const [showPast, setShowPast] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
          <Switch checked={showPast} onCheckedChange={setShowPast} />
          Show past events
        </label>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingEvents
          events={upcoming}
          basePath="/admin/events"
          emptyText="No upcoming events yet."
        />
        {showPast && (
          <UpcomingEvents
            events={past}
            basePath="/admin/events"
            title="Past events"
            emptyText="No past events yet."
          />
        )}
      </div>
    </div>
  )
}
