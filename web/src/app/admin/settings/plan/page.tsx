import { getActiveChurch } from '@/lib/utils/church-scope'
import { getPlanUsage } from '@/lib/services/plan.service'
import { PlanSettings } from '@/components/settings/PlanSettings'

export default async function PlanPage() {
  const { church, churchId, role } = await getActiveChurch()

  if (role !== 'super_admin') {
    return (
      <p className="text-muted-foreground">
        Only super admins can manage the church plan.
      </p>
    )
  }

  const usage = await getPlanUsage(churchId)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plan &amp; Billing</h1>
        <p className="text-sm text-muted-foreground">
          Every plan includes every feature. Plans only differ by how many
          members {church?.name ?? 'your church'} can hold.
        </p>
      </div>
      <PlanSettings churchId={churchId} usage={usage} />
    </div>
  )
}
