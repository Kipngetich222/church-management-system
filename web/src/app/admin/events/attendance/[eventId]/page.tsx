import { getActiveChurch } from '@/lib/utils/church-scope'
import {
  getEventById,
  listEventAttendanceForEvent,
  type EventAttendanceRow,
} from '@/lib/services/events.service'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { BackLink } from '@/components/shared/BackLink'
import { formatEventDate } from '@/lib/utils/date'

function person(a: EventAttendanceRow) {
  const user = a.church_memberships?.users
  return {
    name: user?.full_name ?? 'Unknown member',
    email: user?.email ?? '—',
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function EventAttendanceDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const { churchId } = await getActiveChurch()
  const event = await getEventById(eventId)
  if (!event || event.church_id !== churchId) notFound()

  const attendance = await listEventAttendanceForEvent(eventId)

  return (
    <div className="space-y-6">
      <BackLink href="/admin/events/attendance" label="Confirmed attendance" />

      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatEventDate(event.start_time, event.end_time, event.all_day)} ·{' '}
          {attendance.length} confirmed attendance
          {attendance.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card>
        <CardContent className="py-0">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Checked in at</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((a) => {
                  const p = person(a)
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm">{p.email}</TableCell>
                      <TableCell className="text-sm">{formatWhen(a.scanned_at)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {a.method ?? 'qr'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {attendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      No confirmed attendance yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
