import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { notFound } from 'next/navigation'
import { ShiftForm } from '@/components/volunteers/ShiftForm'
import { ShiftRoster } from '@/components/volunteers/ShiftRoster'
import { ShiftDangerZone } from '@/components/volunteers/ShiftDangerZone'

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>
}) {
  const { shiftId } = await params
  const ctx = await requirePermission('volunteers:*')
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('volunteer_shifts')
    .select('*')
    .eq('id', shiftId)
    .eq('church_id', ctx.churchId)
    .single()

  if (!shift) notFound()

  const { data: signups } = await supabase
    .from('volunteer_signups')
    .select('id, status, signed_up_at, membership_id, church_memberships(users(full_name, email))')
    .eq('shift_id', shiftId)
    .order('signed_up_at')

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Edit shift</h1>

      <ShiftForm churchId={ctx.churchId} existing={shift as any} />

      <ShiftRoster shiftId={shiftId} signups={(signups ?? []) as any} />

      {ctx.role === 'super_admin' && <ShiftDangerZone shiftId={shiftId} />}
    </div>
  )
}