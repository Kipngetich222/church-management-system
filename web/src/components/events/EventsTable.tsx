'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatEventDate, isUpcoming } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { CalendarDays, Globe, MapPin, Search, Ticket } from 'lucide-react'
import type { EventRow, EventStats } from '@/lib/services/events.service'
import { EVENT_VISIBILITY_LABELS } from '@/lib/constants/events'

function visibilityLabel(visibility: EventRow['visibility']) {
  return EVENT_VISIBILITY_LABELS[visibility] ?? visibility
}

export function EventsTable({
  events,
  stats = {},
}: {
  events: EventRow[]
  stats?: Record<string, EventStats>
}) {
  const [q, setQ] = useState('')
  const filtered = events.filter((e) =>
    e.title.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Booked / attended</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const s = stats[e.id]
              return (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {e.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.poster_url} className="h-10 w-16 rounded object-cover" alt="" />
                      ) : (
                        <div className="h-10 w-16 rounded bg-muted grid place-items-center">
                          <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.event_type === 'online'
                            ? 'Online meeting'
                            : e.location_name ?? 'No location'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{formatEventDate(e.start_time, e.end_time, e.all_day)}</div>
                    {isUpcoming(e.start_time) ? (
                      <Badge variant="secondary" className="mt-1 text-xs">Upcoming</Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1 text-xs">Past</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {e.event_type === 'online' ? (
                        <><Globe className="h-3.5 w-3.5" /> Online</>
                      ) : (
                        <><MapPin className="h-3.5 w-3.5" /> Physical</>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      e.status === 'published' ? 'default' :
                      e.status === 'cancelled' ? 'destructive' : 'secondary'
                    }>
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{visibilityLabel(e.visibility)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1 font-medium">
                      <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                      {s?.booked ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.max(s?.confirmed ?? 0, s?.attendance ?? 0)} attended
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/events/${e.id}`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No events found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

