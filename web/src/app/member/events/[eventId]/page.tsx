import { getEventById } from '@/lib/services/events.service'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { notFound } from 'next/navigation'
import { appBaseUrl } from '@/lib/utils/app-url'
import { formatEventDate } from '@/lib/utils/date'
import { googleMapsUrl } from '@/lib/utils/maps'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, MapPin, Globe, Ticket, Video } from 'lucide-react'
import { ShareButton } from '@/components/shared/ShareButton'
import { ChurchMap } from '@/components/maps/ChurchMap'
import { BackLink } from '@/components/shared/BackLink'
import { RegisterForEvent } from '@/components/events/RegisterForEvent'
import { EventCheckIn } from '@/components/events/EventCheckIn'

export default async function MemberEventDetail({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const { churchId } = await getActiveChurch()
  const event = await getEventById(eventId)
  if (!event || event.church_id !== churchId) notFound()

  const maps = googleMapsUrl(event.latitude, event.longitude, event.address)
  const isOnline = event.event_type === 'online'
  const now = new Date()
  const startTime = new Date(event.start_time)
  const endTime = event.end_time ? new Date(event.end_time) : null
  const isPast = event.status === 'completed' || startTime < now
  const hasStarted = now >= startTime
  const hasEnded = event.status === 'completed' || (endTime ? now > endTime : false)
  const canCheckIn =
    event.status === 'published' && hasStarted && !hasEnded
  const showRegistration =
    event.status === 'published' &&
    event.is_registration_required &&
    !isPast

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/member/calendar" label="Calendar" />

      <div className="aspect-video rounded-xl overflow-hidden border bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center">
        {event.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.poster_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <CalendarDays className="h-16 w-16 text-primary/40" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">{event.status}</Badge>
        {isOnline ? (
          <Badge><Globe className="h-3 w-3 mr-1" /> Online</Badge>
        ) : (
          <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" /> Physical</Badge>
        )}
        {event.visibility !== 'public' && (
          <Badge variant="outline">Members event</Badge>
        )}
        {event.is_registration_required && (
          <Badge><Ticket className="h-3 w-3 mr-1" /> Registration required</Badge>
        )}
      </div>

      <h1 className="text-3xl font-bold">{event.title}</h1>

      <div className="flex flex-wrap gap-4 text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {formatEventDate(event.start_time, event.end_time, event.all_day)}
        </div>
        {!isOnline && event.location_name && (
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> {event.location_name}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <ShareButton
          url={`${appBaseUrl()}/e/${event.id}`}
          title={event.title}
        />
        {isOnline && event.meeting_link && !isPast && (
          <Button asChild>
            <a href={event.meeting_link} target="_blank" rel="noreferrer">
              <Video className="h-4 w-4 mr-2" /> Join online
              {event.meeting_platform ? ` (${event.meeting_platform})` : ''}
            </a>
          </Button>
        )}
        {!isOnline && maps && (
          <Button variant="outline" asChild>
            <a href={maps} target="_blank" rel="noreferrer">
              <MapPin className="h-4 w-4 mr-2" /> View location & get directions
            </a>
          </Button>
        )}
      </div>

      {!isOnline && event.latitude != null && event.longitude != null && (
        <ChurchMap
          churches={[
            {
              id: event.id,
              name: event.location_name ?? event.title,
              username: '',
              latitude: event.latitude,
              longitude: event.longitude,
              address: event.address,
              href: null,
            },
          ]}
          height={280}
        />
      )}

      {canCheckIn && <EventCheckIn eventId={event.id} />}

      {event.status === 'published' && !hasStarted && (
        <p className="text-sm text-muted-foreground">
          Check-in opens on{' '}
          {startTime.toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          when the event starts.
        </p>
      )}

      {event.description && (
        <Card>
          <CardContent className="pt-6 whitespace-pre-wrap text-sm">
            {event.description}
          </CardContent>
        </Card>
      )}

      {showRegistration && (
        <Card>
          <CardHeader>
            <CardTitle>Register / tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <RegisterForEvent
              eventId={event.id}
              price={event.price ?? 0}
              currency={event.currency}
              deadline={event.registration_deadline}
              capacity={event.capacity}
              paymentMethod={event.payment_method}
              paymentNumber={event.payment_number}
              paymentAccount={event.payment_account}
              paymentInstructions={event.payment_instructions}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
