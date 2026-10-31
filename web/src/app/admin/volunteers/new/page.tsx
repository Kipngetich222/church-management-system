import { requirePermission } from '@/lib/auth/guard'
import { ShiftForm } from '@/components/volunteers/ShiftForm'
import { BackLink } from '@/components/shared/BackLink'
import { volunteerFormOptions } from '@/lib/services/volunteers.service'

export default async function NewShiftPage() {
  const ctx = await requirePermission('volunteers:*')
  const options = await volunteerFormOptions(ctx.churchId)
  return (
    <div className="space-y-6">
      <BackLink href="/admin/volunteers" label="Volunteers" />

      <h1 className="text-2xl font-bold">New volunteer activity</h1>
      <ShiftForm churchId={ctx.churchId} {...options} />
    </div>
  )
}
