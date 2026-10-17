import { getActiveChurch } from '@/lib/utils/church-scope'
import { MemberForm } from '@/components/members/MemberForm'
import { listMemberBadges } from '@/lib/services/members.service'

export default async function NewMemberPage() {
  const { churchId, role } = await getActiveChurch()
  const badges = await listMemberBadges(churchId)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add member</h1>
        <p className="text-sm text-muted-foreground">
          Add someone with an account or create a manual member record.
        </p>
      </div>
      <MemberForm
        churchId={churchId}
        isSuperAdmin={role === 'super_admin'}
        badges={badges}
      />
    </div>
  )
}
