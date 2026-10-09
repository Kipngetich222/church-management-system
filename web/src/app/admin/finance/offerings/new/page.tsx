import { getActiveChurch } from '@/lib/utils/church-scope'
import { OfferingForm } from '@/components/finance/OfferingForm'

export default async function NewOfferingPage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Record offering</h1>
      <OfferingForm churchId={churchId} />
    </div>
  )
}