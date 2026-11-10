import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { communicationActor } from '@/lib/services/communication-api'
import { checked, type Campaign } from '@/lib/communication'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CommunicationRefresh } from '@/components/communication/CommunicationRefresh'

export default async function MessageHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string }>
}) {
  const { churchId, role, user } = await getActiveChurch()
  const { db } = await communicationActor(churchId)
  const params = await searchParams,
    page = Math.max(1, Math.min(100000, Number(params.page) || 1))
  const view = ['scheduled', 'past'].includes(params.view ?? '')
    ? params.view!
    : 'all'
  let query = db
    .from('message_campaigns')
    .select('*', { count: 'exact' })
    .eq('church_id', churchId)
  if (view === 'scheduled')
    query = query.eq('status', 'scheduled').order('scheduled_at')
  else {
    if (view === 'past') query = query.neq('status', 'scheduled')
    query = query.order('created_at', { ascending: false })
  }
  const result = await query.order('id').range((page - 1) * 25, page * 25 - 1)
  const campaigns = checked(result) as Campaign[]
  return (
    <div className="space-y-6">
      <CommunicationRefresh />
      <h1 className="text-2xl font-bold">
        Message history & scheduled messages
      </h1>
      <nav className="flex gap-3 text-sm" aria-label="Filter history">
        {[
          ['all', 'All messages'],
          ['scheduled', 'Scheduled'],
          ['past', 'Previous messages'],
        ].map(([key, label]) => (
          <Link
            aria-current={view === key ? 'page' : undefined}
            className={`rounded-lg border px-3 py-2 ${view === key ? 'bg-primary text-primary-foreground' : ''}`}
            key={key}
            href={`?view=${key}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {c.channel.toUpperCase()} ·{' '}
                    {formatInTimeZone(
                      c.created_at,
                      'Africa/Nairobi',
                      'd MMM yyyy, h:mm a'
                    )}{' '}
                    EAT · {c.created_by_name}
                  </p>
                  {c.scheduled_at && (
                    <p className="mt-1 text-sm font-medium">
                      Scheduled:{' '}
                      {formatInTimeZone(
                        c.scheduled_at,
                        'Africa/Nairobi',
                        'd MMM yyyy, h:mm a'
                      )}{' '}
                      EAT
                    </p>
                  )}
                </div>
                <Badge
                  variant={c.status === 'scheduled' ? 'secondary' : 'outline'}
                >
                  {c.status}
                </Badge>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap text-sm">
                {c.body}
              </p>
              <p className="text-xs text-muted-foreground">
                {c.total_recipients} recipients · {c.sent_count} accepted ·{' '}
                {c.failed_count} failed / skipped · {c.sms_units} SMS credits
                used
              </p>
              {c.error && <p className="text-sm text-destructive">{c.error}</p>}
              <div className="flex gap-4 text-sm">
                <Link
                  className="underline"
                  href={`/admin/communication/history/${c.id}`}
                >
                  View message & recipients
                </Link>
                {c.status === 'scheduled' &&
                  (role === 'super_admin' || c.created_by === user.id) && (
                    <Link
                      className="underline"
                      href={`/admin/communication/history/${c.id}/edit`}
                    >
                      Edit / cancel schedule
                    </Link>
                  )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!campaigns.length && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No {view === 'scheduled' ? 'scheduled messages' : 'messages'} yet.
            </CardContent>
          </Card>
        )}
      </div>
      <div className="flex gap-4 text-sm">
        {page > 1 && (
          <Link className="underline" href={`?view=${view}&page=${page - 1}`}>
            Previous
          </Link>
        )}
        <span>
          Page {page} · {result.count ?? 0} messages
        </span>
        {(result.count ?? 0) > page * 25 && (
          <Link className="underline" href={`?view=${view}&page=${page + 1}`}>
            Next
          </Link>
        )}
      </div>
    </div>
  )
}
