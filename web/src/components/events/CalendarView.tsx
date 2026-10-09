'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  format, addMonths, subMonths, startOfMonth,
  isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarDays } from '@/lib/utils/calendar'
import { cn } from '@/lib/utils'
import type { EventRow } from '@/lib/services/events.service'

export function CalendarView({
  events,
  basePath = '/admin/events',
}: {
  events: EventRow[]
  basePath?: string
}) {
  const [current, setCurrent] = useState(startOfMonth(new Date()))
  const days = getCalendarDays(current)
  const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const eventsByDay = new Map<string, EventRow[]>()
  events.forEach((e) => {
    const key = e.start_time.slice(0, 10)
    if (!eventsByDay.has(key)) eventsByDay.set(key, [])
    eventsByDay.get(key)!.push(e)
  })

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{format(current, 'MMMM yyyy')}</h3>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setCurrent(subMonths(current, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCurrent(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button size="icon" variant="outline" onClick={() => setCurrent(addMonths(current, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-t border-l">
          {weekLabels.map((d) => (
            <div key={d} className="p-2 text-xs uppercase text-muted-foreground text-center border-r border-b bg-muted/30">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay.get(key) ?? []
            const outside = !isSameMonth(day, current)
            return (
              <div
                key={key}
                className={cn(
                  'min-h-[100px] p-2 border-r border-b text-xs space-y-1',
                  outside && 'bg-muted/20 text-muted-foreground',
                  isToday(day) && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1',
                  isToday(day) && 'text-primary'
                )}>
                  {format(day, 'd')}
                </div>
                {dayEvents.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    href={`${basePath}/${e.id}`}
                    className="block px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate hover:bg-primary/20"
                  >
                    {e.title}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-muted-foreground">+{dayEvents.length - 3} more</div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}