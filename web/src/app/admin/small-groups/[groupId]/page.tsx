import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { getSmallGroup } from '@/lib/services/small-groups.service'
import { notFound } from 'next/navigation'
import { GroupForm } from '@/components/small-groups/GroupForm'
import { GroupMembers } from '@/components/small-groups/GroupMembers'
import { GroupDangerZone } from '@/components/small-groups/GroupDangerZone'
import { BackLink } from '@/components/shared/BackLink'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const { churchId, role } = await getActiveChurch()

  const group = await getSmallGroup(churchId, groupId)
  if (!group) notFound()

  const supabase = await createClient()

  // All members for potential addition / leader selection
  const { data: allMembers } = await supabase
    .from('church_memberships')
    .select('id, users!church_memberships_user_id_fkey(full_name, email)')
    .eq('church_id', churchId)
    .order('joined_at')

  // Current group members
  const { data: groupMembers } = await supabase
    .from('small_group_members')
    .select('id, membership_id, church_memberships(users!church_memberships_user_id_fkey(full_name, email))')
    .eq('group_id', groupId)

  return (
    <div className="space-y-8 max-w-4xl">
      <BackLink href="/admin/small-groups" label="Small groups" />

      <div>
        <h1 className="text-2xl font-bold">Edit small group</h1>
        <p className="text-sm text-muted-foreground">{group.name}</p>
      </div>

      <GroupForm
        churchId={churchId}
        leaders={allMembers ?? []}
        existing={group}
      />

      <GroupMembers
        groupId={groupId}
        allMembers={allMembers ?? []}
        initialMembers={groupMembers ?? []}
      />

      {role === 'super_admin' && <GroupDangerZone groupId={groupId} />}
    </div>
  )
}
