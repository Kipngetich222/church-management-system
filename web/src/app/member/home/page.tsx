import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { getDailyScripture } from '@/lib/services/scripture.service'
import {
  listUpcomingEvents,
  listPastEvents,
} from '@/lib/services/events.service'
import {
  listRecurringServices,
  listServiceExceptions,
} from '@/lib/services/recurring-services.service'
import { addDaysToKey, occurrenceKey, todayKey } from '@/lib/utils/recurrence'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { BadgeChip, findBadgeDefinition } from '@/components/members/BadgeChip'
import { listMemberBadges } from '@/lib/services/members.service'
import { prayerRetentionCutoff } from '@/lib/services/prayer.service'
import { MemberEventsSection } from '@/components/events/MemberEventsSection'
import { UpcomingServices } from '@/components/events/UpcomingServices'
import { Button } from '@/components/ui/button'
import { ChurchMap } from '@/components/maps/ChurchMap'
import { LeadershipSection } from '@/components/churches/LeadershipSection'
import { googleMapsUrl } from '@/lib/utils/maps'
import { getTimeOfDayGreeting } from '@/lib/utils/date'
import { VolunteerOverview } from '@/components/volunteers/VolunteerOverview'

import Link from 'next/link'

import { Pin, Heart, HeartHandshake, HandCoins, MapPin } from 'lucide-react'

export default async function MemberHomePage() {
  // Get the currently active church and member role
  const { churchId, church } = await getActiveChurch()

  // Create Supabase server client
  const supabase = await createClient()

  // Get the currently authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch member information, scripture, events, and announcements
  const today = todayKey()

  const [
    { data: membership },
    scripture,
    upcoming,
    past,
    services,
    exceptions,
    { data: announcements },
    { data: leaders },
  ] = await Promise.all([
    supabase
      .from('church_memberships')
      .select(
        'id, badges, is_baptized, users!church_memberships_user_id_fkey(full_name)'
      )
      .eq('user_id', user!.id)
      .eq('church_id', churchId)
      .single(),

    getDailyScripture(),

    listUpcomingEvents(churchId, 4),

    listPastEvents(churchId, 3),

    listRecurringServices(churchId),

    // Hidden days across the window the services widget looks at, so hidden
    // occurrences never show up on the homepage.
    listServiceExceptions(churchId, today, addDaysToKey(today, 60)),

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

  const { data: assignedRows } = membership
    ? await supabase
        .from('prayer_requests')
        .select('id, title, type, status, created_at')
        .eq('assigned_to', membership.id)
        .eq('church_id', churchId)
        .neq('membership_id', membership.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
    : { data: [] }

  const prayerCutoff = new Date(prayerRetentionCutoff())
  const assignedRequests = (assignedRows ?? []).filter(
    (request) =>
      request.type === 'counseling' ||
      new Date(request.created_at ?? '') >= prayerCutoff
  )
  const badgeDefinitions = await listMemberBadges(churchId)

  // Build the member badge list
  const badges: string[] = [...(membership?.badges ?? [])]

  if (membership?.is_baptized) {
    badges.push('baptized')
  }

  const hiddenOccurrences = new Set(
    exceptions.map((e) => occurrenceKey(e.recurring_service_id, e.service_date))
  )

  const maps = googleMapsUrl(
    church?.latitude,
    church?.longitude,
    church?.address
  )

  const greeting = getTimeOfDayGreeting()
  const memberName =
    membership?.users?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split('@')[0] ||
    'friend'

  return (
    <div className="space-y-8">
      {/* ============================================
WELCOME SECTION
============================================ */}

      <div>
        <h1 className="text-3xl font-bold">
          {greeting || "Hello"}, {memberName || "Member"}
          <br />
          Welcome to {church?.name || "our church"}
        </h1>

        <p className="text-muted-foreground">{church?.description}</p>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {badges.map((badge) => (
              <BadgeChip
                key={badge}
                badge={badge}
                definition={findBadgeDefinition(badge, badgeDefinitions ?? [])}
              />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Link href="/member/prayer#prayer">
            <Heart className="h-6 w-6" />
            Prayer request
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-24 flex-col gap-1 border-amber-500/30"
        >
          <Link href="/member/prayer#counselling">
            <HeartHandshake className="h-6 w-6" />
            Request counselling
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

      {assignedRequests.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Requests assigned to you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {assignedRequests.length} active request
              {assignedRequests.length === 1 ? '' : 's'} have been channelled
              directly to you.
            </p>
            {assignedRequests.slice(0, 3).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {request.title}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {request.type === 'counseling' ? 'Counselling' : 'Prayer'}
                  </p>
                </div>
                <Badge variant="secondary">
                  {request.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
            <Button variant="outline" asChild>
              <Link href="/member/prayer#assigned">Open assigned requests</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {/* ============================================
      UPCOMING SERVICES (RECURRING)
      ============================================ */}

      <UpcomingServices services={services} hidden={hiddenOccurrences} />

      <VolunteerOverview churchId={churchId} />

      {/* ============================================
      UPCOMING EVENTS + ANNOUNCEMENTS
      ============================================ */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}

        <MemberEventsSection
          upcoming={upcoming}
          past={past}
          basePath="/member/events"
        />

        {/* Announcements */}

        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {(announcements ?? []).map((announcement) => (
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
