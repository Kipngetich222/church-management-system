import { getActiveChurch } from '@/lib/utils/church-scope'
import { OfferingForm } from '@/components/finance/OfferingForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewOfferingPage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="space-y-6 max-w-3xl">
      <BackLink href="/admin/finance/offerings" label="Offerings" />

      <h1 className="text-2xl font-bold">Record offering</h1>
      <OfferingForm churchId={churchId} />
    </div>
  )
}