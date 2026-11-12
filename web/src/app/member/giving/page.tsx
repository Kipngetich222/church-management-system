import { getActiveChurch } from '@/lib/utils/church-scope'
import { givingEngine } from '@/lib/services/giving.service'
import { GivingForm } from '@/components/finance/GivingForm'
import { GivingHistoryTable } from '@/components/finance/GivingHistoryTable'

export default async function GivingPage() {
  const { churchId, church, user } = await getActiveChurch()
  const engine = givingEngine()
  const [settings, history, pending] = await Promise.all([
    engine.getSettings(user.id, churchId),
    engine.history(user.id, churchId, 'mine'),
    engine.getPendingPayment(user.id, churchId),
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
          />
        </div>
      </div>
    </div>
  )
}
