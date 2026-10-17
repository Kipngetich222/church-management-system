import { listMemberBadges } from '@/lib/services/members.service'
import { requirePermission } from '@/lib/auth/guard'
import { MemberForm } from '@/components/members/MemberForm'
import { BackLink } from '@/components/shared/BackLink'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Award } from 'lucide-react'

export default async function NewMemberPage() {
  const { churchId, role } = await requirePermission('members:read')
  const badges = await listMemberBadges(churchId)

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/admin/members" label="Members" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Add member</h1>
          <p className="text-sm text-muted-foreground">
            Invite someone with an account or add a member manually for SMS
            communication.
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link href="/admin/members/badges" />}
        >
          <Award className="mr-2 h-4 w-4" /> Manage badges
        </Button>
      </div>

      <MemberForm
        churchId={churchId}
        isSuperAdmin={role === 'super_admin'}
        canAssignBadges={role === 'super_admin' || role === 'dept_admin'}
        badges={badges}
      />
    </div>
  )
}
