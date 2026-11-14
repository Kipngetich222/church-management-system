import { getActiveChurch } from '@/lib/utils/church-scope'
import { givingEngine } from '@/lib/services/giving.service'
import { GivingForm } from '@/components/finance/GivingForm'
import { GivingHistoryTable } from '@/components/finance/GivingHistoryTable'
import { financeEngine } from '@/lib/services/finance.service'
import { financeMoney } from '@/lib/finance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function GivingPage() {
  const { churchId, church, user } = await getActiveChurch()
  const engine = givingEngine()
  const [settings, history, pending, campaigns, pledges] = await Promise.all([
    engine.getSettings(user.id, churchId),
    engine.history(user.id, churchId, 'mine'),
    engine.getPendingPayment(user.id, churchId),
    financeEngine().campaigns(user.id, churchId),
    financeEngine().pledges(user.id, churchId, true),
  ])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Giving</h1>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 xl:order-1">
          <GivingHistoryTable
            key={churchId}
            churchId={churchId}
            scope="mine"
            initial={history}
          />
        </div>
        <div className="order-1 xl:order-2">
          <GivingForm
            key={churchId}
            churchId={churchId}
            churchName={church.name}
            settings={settings}
            initialPayment={pending}
            campaigns={campaigns}
            pledges={pledges}
          />
        </div>
      </div>
      {pledges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My pledges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pledges.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
                <p className="font-medium">
                  {p.campaign_name || 'General pledge'} · {p.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  Committed {financeMoney(p.amount_pledged, p.currency)} ·
                  Received {financeMoney(p.received, p.currency)} · Remaining{' '}
                  {financeMoney(
                    Math.max(0, Number(p.amount_pledged) - Number(p.received)),
                    p.currency
                  )}
                </p>
                {p.ends_on && (
                  <p className="text-xs text-muted-foreground">
                    Due {p.ends_on}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
