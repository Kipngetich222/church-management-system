import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BackLink } from '@/components/shared/BackLink'
import { format } from 'date-fns'
import { History, UserCheck } from 'lucide-react'
import Link from 'next/link'
import {
  firstRelation,
  prayerAuthorName,
  type PrayerRequestRow,
} from '@/lib/types/prayer'

function handlerName(request: PrayerRequestRow) {
  const membership = firstRelation(request.assigned_membership)
  const user = firstRelation(membership?.users)
  return user?.full_name ?? user?.email ?? 'No handler recorded'
}

function HistoryCard({ request }: { request: PrayerRequestRow }) {
  const completedAt = request.closed_at ?? request.created_at

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{request.title}</span>
          <Badge>closed</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-3 text-sm">{request.body}</p>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <span>Requested by: {prayerAuthorName(request)}</span>
          <span>Handled by: {handlerName(request)}</span>
          <span>Opened: {format(new Date(request.created_at), 'MMM d, yyyy')}</span>
          <span>Closed: {format(new Date(completedAt), 'MMM d, yyyy')}</span>
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

export default async function AdminCounsellingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ assigned?: string }>
}) {
  const ctx = await requirePermission('prayer:read')
  const params = await searchParams
  const assignedOnly = params.assigned === 'me'
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', ctx.user.id)
    .eq('church_id', ctx.churchId)
    .single()

  let query = supabase
    .from('prayer_requests')
    .select(
      `
      id, title, body, type, audience, status, visibility, created_at, closed_at,
      assigned_to,
      church_memberships!prayer_requests_membership_id_fkey(users!church_memberships_user_id_fkey(full_name, email)),
      assigned_membership:church_memberships!prayer_requests_assigned_to_fkey(users!church_memberships_user_id_fkey(full_name, email))
    `
    )
    .eq('church_id', ctx.churchId)
    .eq('type', 'counseling')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false, nullsFirst: false })

  if (assignedOnly && membership?.id) {
    query = query.eq('assigned_to', membership.id)
  }

  const { data: requests } = await query
  const history = (requests ?? []) as PrayerRequestRow[]
  const filterHref = assignedOnly
    ? '/admin/prayer-requests/history'
    : '/admin/prayer-requests/history?assigned=me'
  const filterLabel = assignedOnly ? 'Show all handlers' : 'Handled by me'

  return (
    <div className="space-y-6">
      <BackLink
        href="/admin/prayer-requests"
        label="Prayer & Counselling"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <History className="h-6 w-6" />
            Counselling history
          </h1>
          <p className="text-sm text-muted-foreground">
            Closed counselling conversations and the person who handled each
            request.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={filterHref}>
            <UserCheck className="mr-2 h-4 w-4" />
            {filterLabel}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-3xl font-bold">{history.length}</p>
          <p className="text-sm text-muted-foreground">
            {assignedOnly
              ? 'Counselling requests assigned to you and closed.'
              : 'All closed counselling requests in this church.'}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {history.map((request) => (
          <HistoryCard key={request.id} request={request} />
        ))}
        {history.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {assignedOnly
                ? 'You have not closed any assigned counselling requests yet.'
                : 'No counselling requests have been closed yet.'}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
