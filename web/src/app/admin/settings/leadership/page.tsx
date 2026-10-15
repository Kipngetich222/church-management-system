import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { isAdminRole } from '@/lib/auth/redirect'
import { LeadershipManager } from '@/components/settings/LeadershipManager'

export default async function LeadershipPage() {
  const { churchId, role } = await getActiveChurch()

  if (!isAdminRole(role)) {
    return (
      <p className="text-muted-foreground">
        Only church admins can manage the leadership structure.
      </p>
    )
  }

  const supabase = await createClient()
  const { data: leaders } = await supabase
    .from('church_leaders')
    .select('id, name, title, email, phone, image_url, sort_order, created_at')
    .eq('church_id', churchId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Church leadership</h1>
        <p className="text-sm text-muted-foreground">
          List the people who lead your church. Their names, roles and photos
          are shown on your public church profile so members and visitors can
          see who leads you.
        </p>
      </div>

      <LeadershipManager
        churchId={churchId}
        leaders={leaders ?? []}
        canDelete={role === 'super_admin'}
      />
    </div>
  )
}