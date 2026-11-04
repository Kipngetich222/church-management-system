import { requireVisitorAdmin } from '@/lib/services/visitors.service'
import { VisitorForm } from '@/components/visitors/VisitorForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewVisitorPage() {
  const ctx = await requireVisitorAdmin()
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/admin/visitors" label="Visitors" />

      <h1 className="text-2xl font-bold">Add visitor</h1>
      <VisitorForm churchId={ctx.churchId} />
    </div>
  )
}
