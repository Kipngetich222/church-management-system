import { requirePermission } from '@/lib/auth/guard'
import { financeEngine } from '@/lib/services/finance.service'
import { FinanceEntryForm } from '@/components/finance/FinanceEntryForm'
import { BackLink } from '@/components/shared/BackLink'
export default async function NewIncomePage() {
  const { user, churchId } = await requirePermission('finance:write'),
    options = await financeEngine().options(user.id, churchId)
  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/admin/finance/income" label="Other income" />
      <h1 className="text-2xl font-bold">Record other income</h1>
      <FinanceEntryForm churchId={churchId} kind="income" options={options} />
    </div>
  )
}
