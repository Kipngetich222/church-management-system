import { requirePermission } from '@/lib/auth/guard'
import { FinanceNav } from '@/components/finance/FinanceNav'
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePermission('finance:read')
  return (
    <div className="space-y-6">
      <FinanceNav />
      {children}
    </div>
  )
}
