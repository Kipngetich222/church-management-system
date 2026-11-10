import { getActiveChurch } from '@/lib/utils/church-scope'
import { communicationActor } from './communication-api'
import { communicationEngine } from './communication.service'
import { checked } from '@/lib/communication'

export async function composerContext() {
  const context = await getActiveChurch()
  const { db, membership } = await communicationActor(context.churchId)
  const [departments, groups, members, leads] = await Promise.all([
    db
      .from('departments')
      .select('id,name')
      .eq('church_id', context.churchId)
      .order('name'),
    db
      .from('small_groups')
      .select('id,name')
      .eq('church_id', context.churchId)
      .order('name'),
    communicationEngine().recipients(context.churchId, context.user.id, {
      type: 'all',
      ids: [],
    }),
    db
      .from('department_members')
      .select('department_id')
      .eq('membership_id', membership.id)
      .eq('is_leader', true),
  ])
  const leadIds = (checked(leads) ?? []).map(
    (lead: { department_id: string }) => lead.department_id
  )
  return {
    ...context,
    options: {
      departments: (
        checked(departments) as { id: string; name: string }[]
      ).filter((d) => context.role === 'super_admin' || leadIds.includes(d.id)),
      groups: checked(groups) as { id: string; name: string }[],
      members: members.map((member) => ({
        id: member.membership_id,
        name: member.name,
      })),
    },
  }
}
