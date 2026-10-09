import { requirePermission } from '@/lib/auth/guard'
import { VisitorForm } from '@/components/visitors/VisitorForm'

export default async function NewVisitorPage() {
  const ctx = await requirePermission('visitors:*')
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add visitor</h1>
      <VisitorForm churchId={ctx.churchId} />
    </div>
  )
}