import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { communicationActor } from '@/lib/services/communication-api'
import { smsEnvironment } from '@/lib/services/communication.service'
import { checked } from '@/lib/communication'
import { SmsOverview } from '@/components/communication/SmsOverview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommunicationRefresh } from '@/components/communication/CommunicationRefresh'

type LedgerRow = {
  id: string
  kind: string
  units: number
  balance_after: number
  actor_name: string
  campaign_id: string | null
  created_at: string
}
export default async function SmsUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { churchId, role } = await getActiveChurch()
  const { db } = await communicationActor(churchId)
  const page = Math.max(
    1,
    Math.min(100000, Number((await searchParams).page) || 1)
  )
  const result = await db
    .from('sms_credit_ledger')
    .select('*', { count: 'exact' })
    .eq('church_id', churchId)
    .eq('environment', smsEnvironment())
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 50, page * 50 - 1)
  const rows = checked(result) as LedgerRow[]
  return (
    <div className="space-y-6">
      <CommunicationRefresh />
      <h1 className="text-2xl font-bold">SMS usage & audit log</h1>
      <SmsOverview churchId={churchId} role={role} showBreakdown />
      <Card>
        <CardHeader>
          <CardTitle>Credit transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-3">Date (EAT)</th>
                  <th>Action</th>
                  <th>By</th>
                  <th>Credits</th>
                  <th>Available after</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 pr-3">
                      {formatInTimeZone(
                        row.created_at,
                        'Africa/Nairobi',
                        'd MMM yyyy, h:mm a'
                      )}
                    </td>
                    <td className="pr-3">{row.kind}</td>
                    <td className="pr-3">{row.actor_name}</td>
                    <td>{row.units}</td>
                    <td>{row.balance_after}</td>
                    <td>
                      {row.campaign_id && (
                        <Link
                          className="underline"
                          href={`/admin/communication/history/${row.campaign_id}`}
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="py-6 text-sm text-muted-foreground">
              No credit transactions yet.
            </p>
          )}
          <div className="mt-4 flex gap-4 text-sm">
            {page > 1 && (
              <Link className="underline" href={`?page=${page - 1}`}>
                Previous
              </Link>
            )}
            {(result.count ?? 0) > page * 50 && (
              <Link className="underline" href={`?page=${page + 1}`}>
                Next
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
