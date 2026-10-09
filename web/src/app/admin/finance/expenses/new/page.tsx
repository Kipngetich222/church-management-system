import { getActiveChurch } from '@/lib/utils/church-scope'
import { ExpenseForm } from '@/components/finance/ExpenseForm'

export default async function NewExpensePage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Record expense</h1>
      <ExpenseForm churchId={churchId} />
    </div>
  )
}