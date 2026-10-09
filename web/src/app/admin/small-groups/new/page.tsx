import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { GroupForm } from '@/components/small-groups/GroupForm'

export default async function NewGroupPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: leaders } = await supabase
    .from('church_memberships')
    .select('id, users(full_name, email)')
    .eq('church_id', churchId)
    .order('joined_at')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New small group</h1>
        <p className="text-sm text-muted-foreground">
          Create a group and optionally assign a leader.
        </p>
      </div>
      <GroupForm churchId={churchId} leaders={leaders ?? []} />
    </div>
  )
}
