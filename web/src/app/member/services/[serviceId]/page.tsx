import { notFound } from 'next/navigation'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { createClient } from '@/lib/supabase/server'
import {
  getRecurringService,
  getProgramme,
  listHiddenDates,
  WEEKDAY_LABELS,
} from '@/lib/services/recurring-services.service'
import { nextOccurrence, occurrenceKey, todayKey } from '@/lib/utils/recurrence'
import { BackLink } from '@/components/shared/BackLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OccurrenceCheckIn } from '@/components/events/OccurrenceCheckIn'
import { CalendarDays, FileText, MapPin } from 'lucide-react'

export default async function MemberServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  const { churchId, user } = await getActiveChurch()
  const service = await getRecurringService(serviceId)
  if (!service || service.church_id !== churchId) notFound()

  const supabase = await createClient()
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .maybeSingle()

  const today = todayKey()
  const todayIsServiceDay =
    new Date(`${today}T00:00:00`).getDay() === service.day_of_week

  const hiddenDates = await listHiddenDates(service.id)
  const hidden = new Set(hiddenDates.map((d) => occurrenceKey(service.id, d)))
  const todayHidden = hidden.has(occurrenceKey(service.id, today))

  const occurrenceDate = todayIsServiceDay
    ? today
    : nextOccurrence(service, today, hidden)

  const programme = await getProgramme(service.id, occurrenceDate)

  let alreadyCheckedIn = false
  if (membership) {
    const { data } = await supabase
      .from('service_attendance')
      .select('id')
      .eq('recurring_service_id', service.id)
      .eq('service_date', occurrenceDate)
      .eq('membership_id', membership.id)
      .maybeSingle()
    alreadyCheckedIn = !!data
  }

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/member/calendar" label="Calendar" />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          Every {WEEKDAY_LABELS[service.day_of_week]}
        </Badge>
        {service.visibility === 'public' && <Badge variant="outline">Public</Badge>}
      </div>

      <h1 className="text-3xl font-bold">{service.title}</h1>

      <div className="flex flex-wrap gap-4 text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {(service.times ?? [])
            .map((t) => `${t.label}: ${t.start}${t.end ? ` - ${t.end}` : ''}`)
            .join(' - ') || 'Time to be announced'}
        </div>
        {service.location_name && (
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> {service.location_name}
          </div>
        )}
      </div>

      {todayIsServiceDay && !todayHidden ? (
        membership ? (
          <OccurrenceCheckIn
            churchId={churchId}
            serviceId={service.id}
            serviceDate={today}
            membershipId={membership.id}
            alreadyCheckedIn={alreadyCheckedIn}
          />
        ) : null
      ) : (
        <p className="text-sm text-muted-foreground">
          {todayIsServiceDay && todayHidden
            ? 'There is no service today.'
            : `Check-in opens on ${new Date(
                `${occurrenceDate}T00:00:00`
              ).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}, the next ${WEEKDAY_LABELS[service.day_of_week]}.`}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Programme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {programme?.file_url ? (
            <>
              <p className="text-sm text-muted-foreground">
                {programme.title ?? `Programme for ${occurrenceDate}`}
              </p>
              <Button asChild>
                <a href={programme.file_url} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4 mr-2" /> Download programme
                </a>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              The programme for {occurrenceDate} has not been uploaded yet.
            </p>
          )}
        </CardContent>
      </Card>

      {service.description && (
        <Card>
          <CardContent className="pt-6 whitespace-pre-wrap text-sm">
            {service.description}
          </CardContent>
        </Card>
      )}

      {service.procedure && (
        <Card>
          <CardHeader>
            <CardTitle>Order of service</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">
            {service.procedure}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
