import { getActiveChurch } from '@/lib/utils/church-scope'
import { ExpenseForm } from '@/components/finance/ExpenseForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewExpensePage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink href="/admin/finance/expenses" label="Expenses" />

      <h1 className="text-2xl font-bold">Record expense</h1>
      <ExpenseForm churchId={churchId} />
    </div>
  )
}