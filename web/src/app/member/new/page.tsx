import { getActiveChurch } from '@/lib/utils/church-scope'
import { MemberForm } from '@/components/members/MemberForm'

export default async function NewMemberPage() {
  const { churchId, role } = await getActiveChurch()
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add member</h1>
        <p className="text-sm text-muted-foreground">
          Create a member record. They&apos;ll receive an SMS invite.
        </p>
      </div>
      <MemberForm churchId={churchId} isSuperAdmin={role === 'super_admin'} />
    </div>
  )
}
