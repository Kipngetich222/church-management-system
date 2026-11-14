import { FinancePlanForm } from './FinancePlanForm'
import type { FinanceOptions } from '@/lib/finance'
export function CampaignForm({
  churchId,
  options,
}: {
  churchId: string
  options: FinanceOptions
}) {
  return (
    <FinancePlanForm churchId={churchId} options={options} kind="campaign" />
  )
}
