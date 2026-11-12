import Link from 'next/link'
import { Plus, Settings } from 'lucide-react'
import { requirePermission } from '@/lib/auth/guard'
import { userCan } from '@/lib/auth/permissions'
import { givingEngine } from '@/lib/services/giving.service'
import { GivingHistoryTable } from '@/components/finance/GivingHistoryTable'
import { Button } from '@/components/ui/button'

export default async function OfferingsPage() {
  const { churchId, user, role } = await requirePermission('finance:read')
  const [history, canRecord] = await Promise.all([
    givingEngine().history(user.id, churchId, 'church'),
    userCan(churchId, role, 'finance:write'),
  ])
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Church giving</h1>
        <div className="flex flex-wrap gap-2">
          {role === 'super_admin' && (
            <Button asChild variant="outline">
              <Link href="/admin/settings/giving">
                <Settings className="h-4 w-4" />
                Giving settings
              </Link>
            </Button>
          )}
          {canRecord && (
            <Button asChild>
              <Link href="/admin/finance/offerings/new">
                <Plus className="h-4 w-4" />
                Record giving
              </Link>
            </Button>
          )}
        </div>
      </div>
      <GivingHistoryTable
        key={churchId}
        churchId={churchId}
        scope="church"
        initial={history}
      />
    </div>
  )
}
