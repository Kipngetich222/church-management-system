import { getActiveChurch } from '@/lib/utils/church-scope'
import { DepartmentForm } from '@/components/departments/DepartmentForm'

export default async function NewDepartmentPage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New department</h1>
      <DepartmentForm churchId={churchId} />
    </div>
  )
}
