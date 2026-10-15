import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { getDailyScripture } from '@/lib/services/scripture.service'
import { getUpcomingPublicEvents } from '@/lib/services/events.service'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { BadgeChip } from '@/components/members/BadgeChip'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'
import { Button } from '@/components/ui/button'
import { ChurchMap } from '@/components/maps/ChurchMap'
import { LeadershipSection } from '@/components/churches/LeadershipSection'
import { googleMapsUrl } from '@/lib/utils/maps'

import Link from 'next/link'

import { Pin, Heart, HeartHandshake, HandCoins, MapPin } from 'lucide-react'

export default async function MemberHomePage() {
  // Get the currently active church and member role
  const { churchId, church, role } = await getActiveChurch()

  // Create Supabase server client
  const supabase = await createClient()

  // Get the currently authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch member information, scripture, events, and announcements
  const [
    { data: membership },
    scripture,
    upcoming,
    { data: announcements },
    { data: leaders },
  ] = await Promise.all([
    supabase
      .from('church_memberships')
      .select('id, badges, is_baptized')
      .eq('user_id', user!.id)
      .eq('church_id', churchId)
      .single(),

    getDailyScripture(),

    getUpcomingPublicEvents(churchId, 4),

    supabase
      .from('announcements')
      .select('*')
      .eq('church_id', churchId)
      .eq('published', true)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),

    supabase
      .from('church_leaders')
      .select('id, name, title, email, phone, image_url')
      .eq('church_id', churchId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  // Build the member badge list
  const badges: string[] = [...(membership?.badges ?? [])]

  if (membership?.is_baptized) {
    badges.push('baptized')
  }

  const maps = googleMapsUrl(
    church?.latitude,
    church?.longitude,
    church?.address
  )

  return (
    <div className="space-y-8">
      {/* ============================================
WELCOME SECTION
============================================ */}

      <div>
        <h1 className="text-3xl font-bold">Welcome to {church?.name}</h1>

        <p className="text-muted-foreground">{church?.description}</p>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {badges.map((badge) => (
              <BadgeChip key={badge} badge={badge} />
            ))}
          </div>
        )}
      </div>

      {/* ============================================
      VERSE OF THE DAY
      ============================================ */}

      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">
            Verse of the Day
          </p>

          <p className="italic font-serif text-lg">
            &quot;{scripture.text}&quot;
          </p>

          <p className="text-sm text-muted-foreground mt-2">
            — {scripture.reference}
          </p>
        </CardContent>
      </Card>

      {/* ============================================
      MEMBER QUICK ACTIONS
      ============================================ */}

      <div className="grid gap-4 md:grid-cols-3">
        <Button asChild size="lg" className="h-24 flex-col gap-1">
          <Link href="/member/giving">
            <HandCoins className="h-6 w-6" />
            Give offering
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-24 flex-col gap-1"
        >
          <Link href="/member/prayer">
            <HeartHandshake className="h-6 w-6" />
            Prayer request
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-24 flex-col gap-1"
        >
          <Link href="/member/sermons">
            <Heart className="h-6 w-6" />
            Sermons
          </Link>
        </Button>
      </div>

      {/* ============================================
      UPCOMING EVENTS + ANNOUNCEMENTS
      ============================================ */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}

        <UpcomingEvents events={upcoming} basePath="/member/events" />

        {/* Announcements */}

        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {(announcements ?? []).map((announcement: any) => (
              <div
                key={announcement.id}
                className="border-b last:border-0 pb-3 last:pb-0"
              >
                <h3 className="font-medium flex items-center gap-2">
                  {announcement.pinned && (
                    <Pin className="h-3 w-3 text-primary" />
                  )}

                  {announcement.title}
                </h3>

                <p className="text-sm text-muted-foreground mt-1">
                  {announcement.body}
                </p>
              </div>
            ))}

            {(!announcements || announcements.length === 0) && (
              <p className="text-sm text-muted-foreground">
                No announcements yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================
      CHURCH LOCATION
      ============================================ */}

      {/* Church leadership: who leads this church, with contact details */}
      <LeadershipSection leaders={leaders ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>Find us</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {church?.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {church.address}
            </p>
          )}

          {church?.latitude != null && church?.longitude != null ? (
            <>
              <ChurchMap
                churches={[
                  {
                    id: church.id,
                    name: church.name,
                    username: church.username,
                    latitude: church.latitude,
                    longitude: church.longitude,
                    address: church.address,
                    href: null,
                  },
                ]}
                height={320}
              />

              {maps && (
                <Button variant="outline" asChild>
                  <a href={maps} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4 mr-2" /> Get directions
                  </a>
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your church has not set a location yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
