import { getEventById } from '@/lib/services/events.service'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { notFound } from 'next/navigation'
import { formatEventDate } from '@/lib/utils/date'
import { googleMapsUrl } from '@/lib/utils/maps'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, MapPin } from 'lucide-react'
import { ShareButton } from '@/components/shared/ShareButton'

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

  return (
    <div className="max-w-3xl space-y-6">
      {event.poster_url && (
        <div className="aspect-video rounded-xl overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.poster_url} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <h1 className="text-3xl font-bold">{event.title}</h1>

      <div className="flex flex-wrap gap-4 text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {formatEventDate(event.start_time, event.end_time, event.all_day)}
        </div>
        {event.location_name && (
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> {event.location_name}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <ShareButton
          url={`${process.env.NEXT_PUBLIC_APP_URL}/events/${event.id}`}
          title={event.title}
        />
        {maps && (
          <Button variant="outline" asChild>
            <a href={maps} target="_blank" rel="noreferrer">
              <MapPin className="h-4 w-4 mr-2" /> View location
            </a>
          </Button>
        )}
      </div>

      {event.description && (
        <Card>
          <CardContent className="pt-6 whitespace-pre-wrap text-sm">
            {event.description}
          </CardContent>
        </Card>
      )}
    </div>
  )
}