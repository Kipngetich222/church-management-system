import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { userCan } from '@/lib/auth/permissions'
import { notFound } from 'next/navigation'
import { ShiftForm } from '@/components/volunteers/ShiftForm'
import { ShiftRoster } from '@/components/volunteers/ShiftRoster'
import { ShiftDangerZone } from '@/components/volunteers/ShiftDangerZone'
import { ActivityDetails } from '@/components/volunteers/ActivityDetails'
import { BackLink } from '@/components/shared/BackLink'
import {
  listVolunteerActivities,
  listVolunteerParticipants,
  volunteerFormOptions,
} from '@/lib/services/volunteers.service'

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>
}) {
  const { shiftId } = await params
  const ctx = await requirePermission('volunteers:read')
  const supabase = await createClient()
  const { data: shift, error } = await supabase
    .from('volunteer_shifts')
    .select('*')
    .eq('id', shiftId)
    .eq('church_id', ctx.churchId)
    .maybeSingle()
  if (error) throw new Error('Unable to load this activity. Please try again.')
  if (!shift) notFound()
  const [canManage, signups, activities] = await Promise.all([
    userCan(ctx.churchId, ctx.role, 'volunteers:*'),
    listVolunteerParticipants(ctx.churchId, shiftId),
    listVolunteerActivities(ctx.churchId),
  ])
  const activity = activities.find((item) => item.id === shiftId)
  const options = canManage ? await volunteerFormOptions(ctx.churchId) : null
  return (
    <div className="max-w-3xl space-y-8">
      <BackLink href="/admin/volunteers" label="Volunteers" />
      <h1 className="text-2xl font-bold">{shift.title}</h1>
      {activity && <ActivityDetails activity={activity} />}
      <ShiftRoster signups={signups} canManage={canManage} />
      {canManage && options && (
        <ShiftForm churchId={ctx.churchId} existing={shift} {...options} />
      )}
      {canManage && ctx.role === 'super_admin' && (
        <ShiftDangerZone shiftId={shiftId} churchId={ctx.churchId} />
      )}
    </div>
  )
}
