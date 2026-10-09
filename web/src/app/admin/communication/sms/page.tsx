import { getActiveChurch } from '@/lib/utils/church-scope'
import { SMSComposer } from '@/components/communication/SMSComposer'
import { createClient } from '@/lib/supabase/server'

export default async function SMSComposerPage() {
  const { churchId, role } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Dept admin: figure out which depts they lead
  let deptIds: string[] = []
  if (role === 'dept_admin') {
    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user!.id)
      .eq('church_id', churchId)
      .single()

    const { data: leads } = await supabase
      .from('department_members')
      .select('department_id')
      .eq('membership_id', membership!.id)
      .eq('is_leader', true)

    deptIds = leads?.map((d) => d.department_id) ?? []
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Send SMS</h1>
      <SMSComposer churchId={churchId} role={role} deptIds={deptIds} />
    </div>
  )
}