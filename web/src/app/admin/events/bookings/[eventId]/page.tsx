import { getActiveChurch } from '@/lib/utils/church-scope'
import {
  getEventById,
  getEventEngagement,
  listEventRegistrations,
  type EventRegistrationRow,
} from '@/lib/services/events.service'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { BackLink } from '@/components/shared/BackLink'
import { formatEventDate } from '@/lib/utils/date'

function person(r: EventRegistrationRow) {
  const user = r.church_memberships?.users
  return {
    name: user?.full_name ?? r.guest_name ?? 'Guest',
    email: user?.email ?? r.guest_email ?? '—',
    phone: r.guest_phone ?? '—',
  }
}

export default async function EventBookingsDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const { churchId } = await getActiveChurch()
  const event = await getEventById(eventId)
  if (!event || event.church_id !== churchId) notFound()

  const [registrations, stats] = await Promise.all([
    listEventRegistrations(eventId),
    getEventEngagement(eventId),
  ])

  const currency = event.currency ?? 'KES'

  return (
    <div className="space-y-6">
      <BackLink href="/admin/events/bookings" label="Event bookings" />

      <div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatEventDate(event.start_time, event.end_time, event.all_day)} ·{' '}
          {stats.booked} booked · {stats.paid} paid · {currency}{' '}
          {stats.revenue.toLocaleString()} collected
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((r) => {
                  const p = person(r)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm">{p.email}</TableCell>
                      <TableCell className="text-sm">{p.phone}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'cancelled' ? 'destructive' : 'secondary'}>
                          {r.status ?? 'registered'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {r.payment_status ?? '—'}
                        {r.amount_paid != null && r.payment_status === 'paid'
                          ? ` · ${currency} ${Number(r.amount_paid).toLocaleString()}`
                          : ''}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.ticket_code ?? '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {registrations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nobody has booked this event yet.
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
