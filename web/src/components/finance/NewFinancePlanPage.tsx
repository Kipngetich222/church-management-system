import { requirePermission } from '@/lib/auth/guard'
import { financeEngine } from '@/lib/services/finance.service'
import { FinancePlanForm } from './FinancePlanForm'
import { BackLink } from '@/components/shared/BackLink'
export async function NewFinancePlanPage({
  kind,
}: {
  kind: 'campaign' | 'pledge' | 'budget'
}) {
  const { user, churchId } = await requirePermission('finance:write'),
    options = await financeEngine().options(user.id, churchId)
  const path =
    kind === 'campaign'
      ? 'campaigns'
      : kind === 'pledge'
        ? 'pledges'
        : 'budgets'
  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href={`/admin/finance/${path}`} label={path} />
      <h1 className="text-2xl font-bold">New {kind}</h1>
      <FinancePlanForm churchId={churchId} options={options} kind={kind} />
    </div>
  )
}
