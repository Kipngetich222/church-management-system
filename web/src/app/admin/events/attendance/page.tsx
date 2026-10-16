import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { listEvents, getChurchEventStats } from '@/lib/services/events.service'
import { Card, CardContent } from '@/components/ui/card'
import { BackLink } from '@/components/shared/BackLink'
import { formatEventDate } from '@/lib/utils/date'
import { ChevronRight, UserCheck } from 'lucide-react'

export default async function EventAttendancePage() {
  const { churchId } = await getActiveChurch()
  const [events, stats] = await Promise.all([
    listEvents(churchId),
    getChurchEventStats(churchId),
  ])

  const withAttendance = events
    .map((e) => ({ event: e, stat: stats[e.id] }))
    .filter(({ stat }) => (stat?.attendance ?? 0) > 0 || (stat?.confirmed ?? 0) > 0)
    .sort(
      (a, b) =>
        new Date(b.event.start_time).getTime() -
        new Date(a.event.start_time).getTime()
    )

  const totalConfirmed = Object.values(stats).reduce(
    (s, v) => s + Math.max(v.confirmed, v.attendance),
    0
  )

  return (
    <div className="space-y-6">
      <BackLink href="/admin/events" label="Events" />

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCheck className="h-6 w-6" /> Confirmed attendance
        </h1>
        <p className="text-sm text-muted-foreground">
          {totalConfirmed} confirmed check-in{totalConfirmed !== 1 ? 's' : ''}{' '}
          across {withAttendance.length} event
          {withAttendance.length !== 1 ? 's' : ''}. Select an event to see who
          attended.
        </p>
      </div>

      {withAttendance.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No one has checked in to any event yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {withAttendance.map(({ event: e, stat }) => (
            <Link key={e.id} href={`/admin/events/attendance/${e.id}`}>
              <Card className="h-full transition hover:bg-muted/40">
                <CardContent className="pt-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="font-medium truncate block">{e.title}</span>
                    <div className="text-xs text-muted-foreground">
                      {formatEventDate(e.start_time, e.end_time, e.all_day)}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">
                        {Math.max(stat?.confirmed ?? 0, stat?.attendance ?? 0)}
                      </span>{' '}
                      <span className="text-muted-foreground">attended</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
