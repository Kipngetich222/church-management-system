import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { getDailyScripture } from '@/lib/services/scripture.service'
import { getUpcomingPublicEvents } from '@/lib/services/events.service'

import {
Card,
CardContent,
CardHeader,
CardTitle,
} from '@/components/ui/card'

import { BadgeChip } from '@/components/members/BadgeChip'
import { UpcomingEvents } from '@/components/events/UpcomingEvents'
import { Button } from '@/components/ui/button'

import Link from 'next/link'

import {
Pin,
Heart,
HeartHandshake,
HandCoins,
} from 'lucide-react'

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


])

// Build the member badge list
const badges: string[] = [...(membership?.badges ?? [])]

if (membership?.is_baptized) {
badges.push('baptized')
}

return ( <div className="space-y-8">
{/* ============================================
WELCOME SECTION
============================================ */}


  <div>
    <h1 className="text-3xl font-bold">
      Welcome to {church?.name}
    </h1>

    <p className="text-muted-foreground">
      {church?.description}
    </p>

    {badges.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-4">
        {badges.map((badge) => (
          <BadgeChip
            key={badge}
            badge={badge}
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

  <div className="grid gap-4 md:grid-cols-3">
    <Button
      asChild
      size="lg"
      className="h-24 flex-col gap-1"
    >
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

    <UpcomingEvents
      events={upcoming}
      basePath="/member/events"
    />

    {/* Announcements */}

    <Card>
      <CardHeader>
        <CardTitle>
          Announcements
        </CardTitle>
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
</div>


)
}
