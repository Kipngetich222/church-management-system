import { requirePermission } from '@/lib/auth/guard'
import { ShiftForm } from '@/components/volunteers/ShiftForm'

export default async function NewShiftPage() {
  const ctx = await requirePermission('volunteers:*')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New volunteer shift</h1>
      <ShiftForm churchId={ctx.churchId} />
    </div>
  )
}