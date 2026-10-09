import { notFound } from 'next/navigation'
import { formatEventDate, isUpcoming } from '@/lib/utils/date'
import { googleMapsUrl } from '@/lib/utils/maps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, MapPin, Ticket } from 'lucide-react'
import { ShareButton } from '@/components/shared/ShareButton'
import { RegisterForEvent } from '@/components/events/RegisterForEvent'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'

async function loadEvent(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
  const { data } = await supabase
    .from('events')
    .select('*, churches(name, slug, logo_url)')
    .eq('id', id)
    .single()
  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>
}): Promise<Metadata> {
  const { eventId } = await params
  const event = await loadEvent(eventId)
  if (!event) return { title: 'Event not found' }

  const churchRel = event.churches
  const church = Array.isArray(churchRel) ? churchRel[0] : churchRel
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return {
    title: `${event.title} — ${church?.name}`,
    description: event.description?.slice(0, 155) ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: [`${baseUrl}/api/og/event?id=${event.id}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description: event.description ?? undefined,
      images: [`${baseUrl}/api/og/event?id=${event.id}`],
    },
  }
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const event = await loadEvent(eventId)
  if (!event || event.status === 'draft') notFound()

  const churchRel = event.churches
  const church = Array.isArray(churchRel) ? churchRel[0] : churchRel
  const maps = googleMapsUrl(event.latitude, event.longitude, event.address)

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {event.poster_url && (
        <div className="aspect-video rounded-xl overflow-hidden mb-8 border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.poster_url} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{church?.name}</Badge>
          {event.is_registration_required && (
            <Badge><Ticket className="h-3 w-3 mr-1" /> Registration required</Badge>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold">{event.title}</h1>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
            {formatEventDate(event.start_time, event.end_time, event.all_day)}
          </div>
          {event.location_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
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
            <CardContent className="pt-6 whitespace-pre-wrap text-sm leading-relaxed">
              {event.description}
            </CardContent>
          </Card>
        )}

        {event.is_registration_required && isUpcoming(event.start_time) && (
          <RegisterForEvent
            eventId={event.id}
            price={event.price ?? 0}
            currency={event.currency}
            deadline={event.registration_deadline}
            capacity={event.capacity}
          />
        )}
      </div>
    </div>
  )
}


