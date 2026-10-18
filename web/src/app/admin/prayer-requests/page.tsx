import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { prayerRetentionCutoff } from '@/lib/services/prayer.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'
import { Heart, HeartHandshake, Inbox } from 'lucide-react'
import type { PrayerRequestRow } from '@/lib/types/prayer'
import { prayerAuthorName } from '@/lib/types/prayer'

function audienceLabel(request: PrayerRequestRow) {
  if (request.type === 'counseling') return 'Counselling'
  if (request.audience === 'church') return 'Whole church'
  if (request.audience === 'person') return 'Specific leader'
  return 'Pastors & leaders'
}

function AdminRequestCard({ request }: { request: PrayerRequestRow }) {
  const author = prayerAuthorName(request)

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{request.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{audienceLabel(request)}</Badge>
            <Badge
              variant={request.status === 'open' ? 'secondary' : 'default'}
            >
              {request.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <p className="line-clamp-3 text-sm">{request.body}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{author}</span>
          <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/prayer-requests/${request.id}`}>
            Open details
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function Queue({
  title,
  description,
  requests,
  empty,
}: {
  title: string
  description: string
  requests: PrayerRequestRow[]
  empty: string
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {requests.map((request) => (
        <AdminRequestCard key={request.id} request={request} />
      ))}
      {requests.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {empty}
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export default async function AdminPrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ assigned?: string }>
}) {
  const ctx = await requirePermission('prayer:read')
  const params = await searchParams
  const assignedOnly = params.assigned === 'me'
  const supabase = await createClient()
  const cutoff = prayerRetentionCutoff()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', ctx.user.id)
    .eq('church_id', ctx.churchId)
    .single()

  let prayerQuery = supabase
    .from('prayer_requests')
    .select(
      `
      id, title, body, type, audience, status, visibility, created_at, assigned_to,
      church_memberships!prayer_requests_membership_id_fkey(users!church_memberships_user_id_fkey(full_name, email))
    `
    )
    .eq('church_id', ctx.churchId)
    .eq('type', 'prayer')
    .is('archived_at', null)
    .gte('created_at', cutoff)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })

  let counsellingQuery = supabase
    .from('prayer_requests')
    .select(
      `
      id, title, body, type, audience, status, visibility, created_at, assigned_to,
      church_memberships!prayer_requests_membership_id_fkey(users!church_memberships_user_id_fkey(full_name, email))
    `
    )
    .eq('church_id', ctx.churchId)
    .eq('type', 'counseling')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })

  if (assignedOnly && membership?.id) {
    prayerQuery = prayerQuery.eq('assigned_to', membership.id)
    counsellingQuery = counsellingQuery.eq('assigned_to', membership.id)
  }

  const [{ data: prayerRequests }, { data: counsellingRequests }] =
    await Promise.all([prayerQuery, counsellingQuery])

  const prayers = (prayerRequests ?? []) as PrayerRequestRow[]
  const counselling = (counsellingRequests ?? []) as PrayerRequestRow[]
  const filterHref = assignedOnly
    ? '/admin/prayer-requests'
    : '/admin/prayer-requests?assigned=me'
  const filterLabel = assignedOnly ? 'Show all requests' : 'Assigned to me'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prayer & Counselling</h1>
          <p className="text-sm text-muted-foreground">
            Prayer requests and counselling conversations are handled separately
            below.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={filterHref}>
            <Inbox className="mr-2 h-4 w-4" />
            {filterLabel}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Heart className="h-4 w-4" />
              </span>
              Prayer requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{prayers.length}</p>
            <p className="text-sm text-muted-foreground">
              Active prayers from the church and requests sent to specific
              leaders. They leave this queue after seven days, or once answered
              or closed.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="#prayer-queue">View prayer queue</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                <HeartHandshake className="h-4 w-4" />
              </span>
              Counselling requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{counselling.length}</p>
            <p className="text-sm text-muted-foreground">
              Private conversations channelled to a pastor or leader. A request
              stays open until the person handling it closes it.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="#counselling-queue">View counselling queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="prayer-queue">
          <Queue
            title="Prayer queue"
            description="Whole-church, leader-wide and personally assigned prayer requests."
            requests={prayers}
            empty="No active prayer requests right now."
          />
        </div>
        <div id="counselling-queue">
          <Queue
            title="Counselling queue"
            description="Private counselling requests awaiting a response."
            requests={counselling}
            empty="No open counselling requests right now."
          />
        </div>
      </div>
    </div>
  )
}
