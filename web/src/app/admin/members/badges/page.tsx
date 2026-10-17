import { requirePermission } from '@/lib/auth/guard'
import { listMemberBadges, listMembers } from '@/lib/services/members.service'
import { BadgeManager } from '@/components/members/BadgeManager'
import { BackLink } from '@/components/shared/BackLink'
import { Award } from 'lucide-react'

export default async function MemberBadgesPage() {
  const { churchId } = await requirePermission('members:read')
  const members = await listMembers(churchId)
  const badges = await listMemberBadges(churchId, members)

  return (
    <div className="space-y-6">
      <BackLink href="/admin/members" label="Members" />

      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Award className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Member badges</h1>
          <p className="text-sm text-muted-foreground">
            Create the leadership, ministry, and service roles your church uses,
            then assign them to members. Add as many as you need — there is no
            fixed list.
          </p>
        </div>
      </div>

      <BadgeManager churchId={churchId} initialBadges={badges} />
    </div>
  )
}
