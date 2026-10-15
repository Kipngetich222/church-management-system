import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { ChurchLogo } from '@/components/shared/ChurchLogo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatEventDate } from '@/lib/utils/date'
import { googleMapsUrl } from '@/lib/utils/maps'
import { ChurchMap } from '@/components/maps/ChurchMap'
import { JoinChurchButton } from '@/components/churches/JoinChurchButton'
import { LeadershipSection } from '@/components/churches/LeadershipSection'
import { MapPin, CalendarDays, Mail, Globe, Phone } from 'lucide-react'

export const revalidate = 60

async function loadChurch(username: string) {
  const supabase = createPublicClient()
  const { data: church } = await supabase
    .from('churches')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (!church) return { church: null, events: [], leaders: [] }

  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, start_time, end_time, all_day, location_name, poster_url')
    .eq('church_id', church.id)
    .eq('visibility', 'public')
    .in('status', ['published'])
    .gte('start_time', new Date().toISOString())
    .order('start_time')
    .limit(6)

  const { data: leaders } = await supabase
    .from('church_leaders')
    .select('id, name, title, email, phone, image_url')
    .eq('church_id', church.id)
    .order('sort_order')
    .order('created_at')

  return { church, events: events ?? [], leaders: leaders ?? [] }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const { church } = await loadChurch(username)
  if (!church) return { title: 'Church not found' }
  return {
    title: `${church.name} â€” ChurchOnline`,
    description: church.description ?? undefined,
  }
}

export default async function ChurchProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const { church, events, leaders } = await loadChurch(username)
  if (!church) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const maps = googleMapsUrl(church.latitude, church.longitude, church.address)
  const joinHref = `/register?church=${church.username}`

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10">
        <ChurchLogo name={church.name} logoUrl={church.logo_url} size="xl" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">{church.name}</h1>
          </div>
          <p className="text-muted-foreground">
            {church.description ?? 'A church community on ChurchOnline.'}
          </p>
        </div>
        {user ? (
          <JoinChurchButton churchId={church.id} />
        ) : (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={joinHref} />}
          >
            Join this church
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Contact & location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {church.address && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {church.address}
              </p>
            )}
            {church.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {church.phone}
              </p>
            )}
            {church.email && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {church.email}
              </p>
            )}
            {church.website && (
              <a
                href={church.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Globe className="h-4 w-4" /> {church.website}
              </a>
            )}
            {maps && (
              <Button variant="outline" size="sm" nativeButton={false} render={<a href={maps} target="_blank" rel="noreferrer" />}>
                <MapPin className="h-4 w-4 mr-2" /> View on map
              </Button>
            )}
            {church.latitude != null && church.longitude != null && (
              <ChurchMap
                churches={[
                  {
                    id: church.id,
                    name: church.name,
                    username: church.username,
                    latitude: church.latitude,
                    longitude: church.longitude,
                    address: church.address,
                  },
                ]}
                height={260}
                className="mt-2"
              />
            )}
            {!church.address && !church.phone && !church.email && !church.website && (
              <p className="text-muted-foreground">No contact details yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public events.</p>
            ) : (
              events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block p-3 rounded-lg hover:bg-muted/50 transition"
                >
                  <div className="font-medium text-sm line-clamp-2">
                    {event.title}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatEventDate(event.start_time, event.end_time, event.all_day ?? false)}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {leaders.length > 0 && (
        <div className="mt-6">
          <LeadershipSection leaders={leaders} />
        </div>
      )}
    </div>
  )
}
