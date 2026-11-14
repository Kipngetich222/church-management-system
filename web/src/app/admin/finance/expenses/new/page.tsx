import { requirePermission } from '@/lib/auth/guard'
import { financeEngine } from '@/lib/services/finance.service'
import { ExpenseForm } from '@/components/finance/ExpenseForm'
import { BackLink } from '@/components/shared/BackLink'
export default async function NewExpensePage() {
  const { churchId, user } = await requirePermission('finance:write'),
    options = await financeEngine().options(user.id, churchId)
  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink href="/admin/finance/expenses" label="Expenses & bills" />
      <h1 className="text-2xl font-bold">Record expense or bill</h1>
      <ExpenseForm churchId={churchId} options={options} />
    </div>
  )
}
