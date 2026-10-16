import { getActiveChurch } from '@/lib/utils/church-scope'
import { createClient } from '@/lib/supabase/server'
import { getEventById, getEventEngagement } from '@/lib/services/events.service'
import { EventForm } from '@/components/events/EventForm'
import { EventQrPanel } from '@/components/events/EventQrPanel'
import { BackLink } from '@/components/shared/BackLink'
import { Card, CardContent } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import { CalendarCheck, Ticket, UserCheck, Wallet } from 'lucide-react'

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const [event, stats, { data: departments }, { data: groups }] =
    await Promise.all([
      getEventById(eventId),
      getEventEngagement(eventId),
      supabase
        .from('departments')
        .select('id, name')
        .eq('church_id', churchId)
        .order('name'),
      supabase
        .from('small_groups')
        .select('id, name')
        .eq('church_id', churchId)
        .order('name'),
    ])

  if (!event || event.church_id !== churchId) notFound()

  const currency = event.currency ?? 'KES'

  return (
    <div className="max-w-3xl space-y-8">
      <BackLink href="/admin/events" label="Events" />

      <h1 className="text-2xl font-bold">Edit event</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={event.is_registration_required ? 'Registered / booked' : 'Registered'}
          value={String(stats.booked)}
          icon={Ticket}
        />
        <Stat
          label="Confirmed attendance"
          value={String(Math.max(stats.confirmed, stats.attendance))}
          icon={UserCheck}
        />
        <Stat
          label="Paid registrations"
          value={String(stats.paid)}
          icon={CalendarCheck}
        />
        <Stat
          label="Collected"
          value={`${currency} ${stats.revenue.toLocaleString()}`}
          icon={Wallet}
        />
      </div>

      <EventForm
        churchId={churchId}
        existing={event}
        departments={departments ?? []}
        groups={groups ?? []}
      />

      <EventQrPanel eventId={eventId} qrCode={event.qr_code} />
    </div>
  )
}


