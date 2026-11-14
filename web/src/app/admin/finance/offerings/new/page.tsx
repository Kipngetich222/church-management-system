import { requirePermission } from '@/lib/auth/guard'
import { OfferingForm } from '@/components/finance/OfferingForm'
import { BackLink } from '@/components/shared/BackLink'
import { financeEngine } from '@/lib/services/finance.service'

export default async function NewOfferingPage() {
  const { churchId, user } = await requirePermission('finance:write')
  const options = await financeEngine().options(user.id, churchId)
  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink href="/admin/finance/offerings" label="Offerings" />

      <h1 className="text-2xl font-bold">Record offering</h1>
      <OfferingForm churchId={churchId} options={options} />
    </div>
  )
}
