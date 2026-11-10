import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { communicationActor } from '@/lib/services/communication-api'
import { checked, type Campaign, type Message } from '@/lib/communication'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CommunicationRefresh } from '@/components/communication/CommunicationRefresh'

export default async function CampaignDetail({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { churchId, role, user } = await getActiveChurch()
  const { db } = await communicationActor(churchId)
  const { campaignId } = await params
  const query = await searchParams
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1))
  const campaign = checked(
    await db
      .from('message_campaigns')
      .select('*')
      .eq('church_id', churchId)
      .eq('id', campaignId)
      .maybeSingle()
  ) as Campaign | null
  if (!campaign) notFound()
  const [rows, events] = await Promise.all([
    db
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('church_id', churchId)
      .eq('campaign_id', campaign.id)
      .order('created_at')
      .order('id')
      .range((page - 1) * 50, page * 50 - 1),
    db
      .from('audit_logs')
      .select(
        'id,action,created_at,actor_id,users!audit_logs_actor_id_fkey(full_name,email)'
      )
      .eq('church_id', churchId)
      .eq('entity_id', campaign.id)
      .order('created_at', { ascending: false }),
  ])
  const messages = checked(rows) as Message[]
  const audit = checked(events) as unknown as {
    id: string
    action: string
    created_at: string
    users: { full_name: string | null; email: string | null } | null
  }[]
  const time = (value: string) =>
    formatInTimeZone(value, 'Africa/Nairobi', 'd MMM yyyy, h:mm a') + ' EAT'
  return (
    <div className="space-y-6">
      <CommunicationRefresh />
      <Link href="/admin/communication/history" className="text-sm underline">
        Back to message history
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Message details</h1>
        {campaign.status === 'scheduled' &&
          (role === 'super_admin' || campaign.created_by === user.id) && (
            <Button asChild>
              <Link href={`/admin/communication/history/${campaign.id}/edit`}>
                Edit schedule
              </Link>
            </Button>
          )}
      </div>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            {campaign.channel.toUpperCase()} · {campaign.status} ·{' '}
            {campaign.sms_environment}
          </p>
          {campaign.subject && (
            <h2 className="font-semibold">{campaign.subject}</h2>
          )}
          <p className="whitespace-pre-wrap">{campaign.body}</p>
          <p className="text-sm">
            Created by {campaign.created_by_name} · {time(campaign.created_at)}
          </p>
          {campaign.scheduled_at && (
            <p className="text-sm">
              Scheduled for {time(campaign.scheduled_at)}
            </p>
          )}
          <p className="text-sm">
            {campaign.total_recipients} recipients · {campaign.sent_count}{' '}
            accepted · {campaign.failed_count} failed / skipped ·{' '}
            {campaign.sms_units} SMS credits used
          </p>
          {campaign.error && (
            <p role="alert" className="text-sm text-destructive">
              {campaign.error}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recipient delivery history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            Accepted means the provider accepted the SMS for delivery. Handset
            delivery may occur later.
          </p>
          {messages.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="pb-3">Recipient</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Credits</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((message) => (
                    <tr className="border-t" key={message.id}>
                      <td className="py-3 pr-3">
                        {message.recipient_name || 'Member'}
                      </td>
                      <td className="pr-3">
                        {campaign.channel === 'in_app'
                          ? 'Private inbox'
                          : message.to_address}
                      </td>
                      <td className="pr-3">
                        {message.status === 'sent'
                          ? 'Accepted'
                          : message.status}
                      </td>
                      <td className="pr-3">
                        {message.credit_state === 'charged'
                          ? message.sms_parts
                          : 0}
                        {message.credit_state === 'reserved' &&
                          ` (${message.sms_parts} held)`}
                      </td>
                      <td className="max-w-xs text-xs">
                        {message.error || message.provider_id || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {campaign.status === 'scheduled'
                ? 'Recipients and delivery records will be created when this message is sent.'
                : 'No recipient delivery records.'}
            </p>
          )}
          <div className="mt-4 flex gap-4 text-sm">
            {page > 1 && (
              <Link className="underline" href={`?page=${page - 1}`}>
                Previous
              </Link>
            )}
            {(rows.count ?? 0) > page * 50 && (
              <Link className="underline" href={`?page=${page + 1}`}>
                Next recipients
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Campaign audit trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.map((event) => (
            <p className="text-sm" key={event.id}>
              {time(event.created_at)} ·{' '}
              {event.action
                .replaceAll('communication.', '')
                .replaceAll('_', ' ')}{' '}
              ·{' '}
              {event.users?.full_name ||
                event.users?.email ||
                'System / former administrator'}
            </p>
          ))}
          {!audit.length && (
            <p className="text-sm text-muted-foreground">
              No additional audit events.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
