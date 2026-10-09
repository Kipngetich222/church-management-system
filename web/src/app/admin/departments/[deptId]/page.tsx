import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { notFound } from 'next/navigation'
import { DepartmentForm } from '@/components/departments/DepartmentForm'
import { DepartmentMembers } from '@/components/departments/DepartmentMembers'
import { DepartmentDangerZone } from '@/components/departments/DepartmentDangerZone'

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ deptId: string }>
}) {
  const { deptId } = await params
  const { churchId, role } = await getActiveChurch()
  const supabase = await createClient()

  const { data: dept } = await supabase
    .from('departments')
    .select('*')
    .eq('id', deptId)
    .eq('church_id', churchId)
    .single()

  if (!dept) notFound()

  const { data: allMembers } = await supabase
    .from('church_memberships')
    .select('id, users(full_name, email, avatar_url)')
    .eq('church_id', churchId)

  const { data: deptMembers } = await supabase
    .from('department_members')
    .select(
      'id, is_leader, membership_id, church_memberships(users(full_name, email))'
    )
    .eq('department_id', deptId)

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold">Edit department</h1>

      <DepartmentForm churchId={churchId} existing={dept} />

      <DepartmentMembers
        departmentId={deptId}
        allMembers={allMembers ?? []}
        initialMembers={deptMembers ?? []}
      />

      {role === 'super_admin' && <DepartmentDangerZone departmentId={deptId} />}
    </div>
  )
}
