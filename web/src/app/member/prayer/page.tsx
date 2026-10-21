import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import {
  listPrayerTargets,
  prayerRetentionCutoff,
} from '@/lib/services/prayer.service'
import { PrayerRequestForm } from '@/components/prayer/PrayerRequestForm'
import { MemberRequestActions } from '@/components/prayer/MemberRequestActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Heart, HeartHandshake } from 'lucide-react'
import type { PrayerInteractionRow, PrayerRequestRow } from '@/lib/types/prayer'

const REQUEST_SELECT = `
  *,
  prayer_interactions(id, body, created_at, is_internal, author_membership_id)
`

function statusBadge(status: string) {
  const label = status.replace('_', ' ')
  if (status === 'answered' || status === 'closed') {
    return <Badge variant="default">{label}</Badge>
  }
  return <Badge variant="secondary">{label}</Badge>
}

function audienceLabel(request: PrayerRequestRow) {
  if (request.type === 'counseling') return 'Counselling'
  if (request.audience === 'church') return 'Whole church'
  if (request.audience === 'person') return 'Specific leader'
  return 'Pastors & leaders'
}

function RequestCard({
  request,
  actions,
}: {
  request: PrayerRequestRow
  actions?: React.ReactNode
}) {
  const replies = (request.prayer_interactions ?? []).filter(
    (interaction: PrayerInteractionRow) => !interaction.is_internal
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{request.title}</span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">{audienceLabel(request)}</Badge>
            {statusBadge(request.status)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm whitespace-pre-wrap">{request.body}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), 'MMM d, yyyy')}
        </p>

        {replies.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {replies.map((reply: PrayerInteractionRow) => (
              <div key={reply.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm">{reply.body}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>
        )}

        {actions}
      </CardContent>
    </Card>
  )
}

function RequestSection({
  title,
  description,
  requests,
  empty,
  actionsFor,
}: {
  title: string
  description?: string
  requests: PrayerRequestRow[]
  empty: string
  actionsFor?: (request: PrayerRequestRow) => React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          actions={actionsFor?.(request)}
        />
      ))}
      {requests.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {empty}
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export default async function PrayerPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  if (!membership) {
    return (
      <p className="text-sm text-muted-foreground">
        We could not find your church membership.
      </p>
    )
  }

  const cutoff = prayerRetentionCutoff()
  const cutoffDate = new Date(cutoff)

  const [
    targets,
    prayerResult,
    handledHistoryResult,
    counsellingResult,
    incomingResult,
    churchResult,
  ] = await Promise.all([
    listPrayerTargets(churchId),

    supabase
      .from('prayer_requests')
      .select(REQUEST_SELECT)
      .eq('membership_id', membership.id)
      .eq('type', 'prayer')
      .is('archived_at', null)
      .gte('created_at', cutoff)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false }),

    supabase
      .from('prayer_requests')
      .select(REQUEST_SELECT)
      .eq('assigned_to', membership.id)
      .eq('church_id', churchId)
      .eq('type', 'counseling')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false, nullsFirst: false }),

    supabase
      .from('prayer_requests')
      .select(REQUEST_SELECT)
      .eq('membership_id', membership.id)
      .eq('type', 'counseling')
      .order('created_at', { ascending: false }),

    supabase
      .from('prayer_requests')
      .select(REQUEST_SELECT)
      .eq('assigned_to', membership.id)
      .eq('church_id', churchId)
      .neq('membership_id', membership.id)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false }),

    supabase
      .from('prayer_requests')
      .select(REQUEST_SELECT)
      .eq('church_id', churchId)
      .eq('type', 'prayer')
      .eq('audience', 'church')
      .neq('membership_id', membership.id)
      .is('archived_at', null)
      .gte('created_at', cutoff)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const myPrayers = (prayerResult.data ?? []) as PrayerRequestRow[]
  const myCounselling = (counsellingResult.data ?? []) as PrayerRequestRow[]
  const incoming = ((incomingResult.data ?? []) as PrayerRequestRow[]).filter(
    (request: PrayerRequestRow) =>
      request.type === 'counseling' ||
      new Date(request.created_at) >= cutoffDate
  )
  const handledHistory = (handledHistoryResult.data ??
    []) as PrayerRequestRow[]
  const churchPrayers = (churchResult.data ?? []) as PrayerRequestRow[]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Prayer & Counselling</h1>
        <p className="text-sm text-muted-foreground">
          Send a prayer request or ask for a private conversation with a pastor
          or leader.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="prayer" className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Heart className="h-4 w-4" />
              </span>
              Prayer request
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Share a prayer need with the whole church, all pastors and
              leaders, or one person you trust.
            </p>
          </CardHeader>
          <CardContent>
            <PrayerRequestForm
              churchId={churchId}
              membershipId={membership.id}
              kind="prayer"
              targets={targets}
            />
          </CardContent>
        </Card>

        <Card id="counselling" className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                <HeartHandshake className="h-4 w-4" />
              </span>
              Counselling request
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Request a private conversation and choose the pastor or leader you
              would like to speak with.
            </p>
          </CardHeader>
          <CardContent>
            <PrayerRequestForm
              churchId={churchId}
              membershipId={membership.id}
              kind="counseling"
              targets={targets}
            />
          </CardContent>
        </Card>
      </div>

      {(incoming.length > 0 || handledHistory.length > 0) && (
        <div id="assigned" className="space-y-6">
          <RequestSection
            title="Assigned to you"
            description="Active requests that a member has channelled directly to you."
            requests={incoming}
            empty="Nothing assigned to you right now."
            actionsFor={(request) => (
              <MemberRequestActions
                requestId={request.id}
                membershipId={membership.id}
                kind={request.type}
                status={request.status}
              />
            )}
          />

          {handledHistory.length > 0 && (
            <div id="counselling-history">
              <RequestSection
                title="Counselling history"
                description="Counselling conversations you handled and closed."
                requests={handledHistory}
                empty="You have not closed any counselling requests yet."
              />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RequestSection
          title="My prayer requests"
          description="Prayer requests stay here for seven days, or until they are answered or closed."
          requests={myPrayers}
          empty="You have no active prayer requests."
        />

        <RequestSection
          title="My counselling requests"
          description="Counselling requests remain here until the person handling them closes the request."
          requests={myCounselling}
          empty="You have not requested counselling yet."
        />
      </div>

      <div id="church-prayers">
        <RequestSection
          title="Church prayer requests"
          description="Active prayer requests shared with the whole church."
          requests={churchPrayers}
          empty="No church-wide prayer requests are active right now."
        />
      </div>
    </div>
  )
}
