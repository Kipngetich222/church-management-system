import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { communicationActor } from '@/lib/services/communication-api'
import {
  smsPurchaseConfiguration,
  type SmsPurchase,
} from '@/lib/services/sms-purchases.service'
import { checked } from '@/lib/communication'
import { SmsOverview } from '@/components/communication/SmsOverview'
import { SmsPurchaseForm } from '@/components/communication/SmsPurchaseForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PurchaseSmsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { churchId, role } = await getActiveChurch()
  if (role !== 'super_admin') redirect('/admin/communication/sms')
  const { db } = await communicationActor(churchId, true)
  const config = smsPurchaseConfiguration()
  const page = Math.max(
    1,
    Math.min(100000, Number((await searchParams).page) || 1)
  )
  const [history, pending] = await Promise.all([
    db
      .from('sms_purchases')
      .select('*', { count: 'exact' })
      .eq('church_id', churchId)
      .eq('environment', config.environment)
      .order('created_at', { ascending: false })
      .order('id')
      .range((page - 1) * 25, page * 25 - 1),
    db
      .from('sms_purchases')
      .select('*')
      .eq('church_id', churchId)
      .eq('environment', config.environment)
      .in('status', ['initiating', 'pending', 'review'])
      .maybeSingle(),
  ])
  const purchases = checked(history) as SmsPurchase[]
  const open = checked(pending) as SmsPurchase | null
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Buy SMS for your church</h1>
      <p className="text-muted-foreground">
        Purchase prepaid SMS credits here. Your church does not need an Africa’s
        Talking account.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>How to purchase</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Choose a bundle and enter the M-Pesa number that will pay.</li>
            <li>
              Select Buy SMS and approve the payment prompt on that phone.
            </li>
            <li>
              After payment is verified, credits are added automatically and
              every church admin can use them, including department leaders.
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Credits belong to this church. One credit sends one SMS part to one
            phone number; long messages and Unicode may use multiple parts.
            Purchases and usage are recorded in the audit log.
          </p>
          {config.environment === 'sandbox' && (
            <p className="mt-3 text-sm font-medium">
              Test mode: payments use the Daraja simulator, without a real phone
              prompt. Test credits cannot fund live SMS.
            </p>
          )}
          {config.pricingSource === 'africas-talking-basic' && (
            <p className="mt-3 text-sm text-muted-foreground">
              Kenya SMS pricing follows Africa’s Talking’s Basic rate: KES 0.80
              per part plus 16% VAT (KES 0.928). Bundle totals include VAT and
              are rounded up to a whole shilling for M-Pesa.
            </p>
          )}
        </CardContent>
      </Card>
      <SmsPurchaseForm
        key={`${churchId}:${config.environment}`}
        churchId={churchId}
        enabled={config.enabled}
        bundles={config.bundles}
        issues={config.issues}
        environment={config.environment}
        initial={open}
      />
      <SmsOverview churchId={churchId} role={role} />
      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-3">Date (EAT)</th>
                  <th>Purchased by</th>
                  <th>Credits</th>
                  <th>Amount</th>
                  <th>Status / receipt</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr className="border-t" key={p.id}>
                    <td className="py-3 pr-3">
                      {formatInTimeZone(
                        p.created_at,
                        'Africa/Nairobi',
                        'd MMM yyyy, h:mm a'
                      )}
                    </td>
                    <td className="pr-3">{p.created_by_name}</td>
                    <td className="pr-3">{p.credits.toLocaleString()}</td>
                    <td className="pr-3">
                      KES {p.amount_kes.toLocaleString()}
                    </td>
                    <td>
                      {p.status}
                      {p.receipt && ` · ${p.receipt}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!purchases.length && (
            <p className="py-6 text-sm text-muted-foreground">
              No purchases yet.
            </p>
          )}
          <div className="mt-4 flex gap-4 text-sm">
            {page > 1 && (
              <Link className="underline" href={`?page=${page - 1}`}>
                Previous
              </Link>
            )}
            {(history.count ?? 0) > page * 25 && (
              <Link className="underline" href={`?page=${page + 1}`}>
                Next purchases
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
