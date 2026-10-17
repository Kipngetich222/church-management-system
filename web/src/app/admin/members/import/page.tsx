import { requirePermission } from '@/lib/auth/guard'
import { MemberImport } from '@/components/members/MemberImport'
import { BackLink } from '@/components/shared/BackLink'

export default async function ImportPage() {
  const { churchId } = await requirePermission('members:read')

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/admin/members" label="Members" />
      <div>
        <h1 className="text-2xl font-bold">Import members from CSV</h1>
        <p className="text-sm text-muted-foreground">
          Add account members or manual members in bulk.
        </p>
      </div>
      <MemberImport churchId={churchId} />
    </div>
  )
}
