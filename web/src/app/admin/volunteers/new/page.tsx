import { requirePermission } from '@/lib/auth/guard'
import { ShiftForm } from '@/components/volunteers/ShiftForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewShiftPage() {
  const ctx = await requirePermission('volunteers:*')
  return (
    <div className="space-y-6">
      <BackLink href="/admin/volunteers" label="Volunteers" />

      <h1 className="text-2xl font-bold">New volunteer shift</h1>
      <ShiftForm churchId={ctx.churchId} />
    </div>
  )
}