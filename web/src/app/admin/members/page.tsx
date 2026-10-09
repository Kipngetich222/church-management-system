import { getActiveChurch } from '@/lib/utils/church-scope'
import { listMembers } from '@/lib/services/members.service'
import { MembersTable } from '@/components/members/MembersTable'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { requirePermission } from '@/lib/auth/guard'

export default async function MembersPage() {
  const { churchId } = await getActiveChurch()
  const members = await listMembers(churchId)
  const ctx = await requirePermission('members:read')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/members/import" />}
          >
            <Upload className="h-4 w-4 mr-2" /> Import CSV
          </Button>
          <Button render={<Link href="/admin/members/new" />}>
            <Plus className="h-4 w-4 mr-2" /> Add member
          </Button>
        </div>
      </div>

      <MembersTable members={members} churchId={churchId} />
    </div>
  )
}
