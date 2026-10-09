import Link from 'next/link'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatEventDate } from '@/lib/utils/date'
import { CalendarDays, MapPin, Ticket } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Events — ChurchMS',
  description:
    'Discover upcoming church events, services, conferences and gatherings near you.',
}

export const revalidate = 60

async function loadEvents() {
  const supabase = createPublicClient()
  const now = new Date().toISOString()

  const [upcomingRes, pastRes] = await Promise.all([
    supabase
      .from('events')
      .select('*, churches(name, slug)')
      .eq('visibility', 'public')
      .in('status', ['published', 'completed'])
      .gte('start_time', now)
      .order('start_time')
      .limit(60),
    supabase
      .from('events')
      .select('*, churches(name, slug)')
      .eq('visibility', 'public')
      .in('status', ['published', 'completed'])
      .lt('start_time', now)
      .order('start_time', { ascending: false })
      .limit(12),
  ])

  return {
    upcoming: upcomingRes.data ?? [],
    past: pastRes.data ?? [],
  }
}

type PublicEvent = Awaited<ReturnType<typeof loadEvents>>['upcoming'][number]

function EventCard({ event }: { event: PublicEvent }) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="h-full overflow-hidden hover:shadow-md transition">
        {event.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.poster_url}
            alt={event.title}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="aspect-video w-full bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center">
            <CalendarDays className="h-12 w-12 text-primary/40" />
          </div>
        )}
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{event.churches?.name}</Badge>
            {event.is_registration_required && (
              <Badge>
                <Ticket className="h-3 w-3 mr-1" /> Tickets
              </Badge>
            )}
          </div>
          <h3 className="font-medium line-clamp-2">{event.title}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatEventDate(event.start_time, event.end_time, event.all_day ?? false)}
          </p>
          {event.location_name && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {event.location_name}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function EventsPage() {
  const { upcoming, past } = await loadEvents()

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mb-10">
        <h1 className="text-4xl font-bold mb-3">Church events</h1>
        <p className="text-muted-foreground">
          Services, conferences, outreaches and gatherings happening across our
          partner churches.
        </p>
      </div>

      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-6">Upcoming</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-3">
              <CalendarDays className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <p className="font-medium">No upcoming public events yet.</p>
              <p className="text-sm text-muted-foreground">
                Check back soon, or follow your church for updates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-6">Recently held</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}


