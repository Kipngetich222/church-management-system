import { FinanceEntryForm } from './FinanceEntryForm'
import type { FinanceOptions } from '@/lib/finance'
export function ExpenseForm({
  churchId,
  options,
}: {
  churchId: string
  options: FinanceOptions
}) {
  return (
    <FinanceEntryForm churchId={churchId} options={options} kind="expense" />
  )
}
