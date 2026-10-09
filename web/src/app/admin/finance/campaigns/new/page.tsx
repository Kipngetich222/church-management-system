import { getActiveChurch } from '@/lib/utils/church-scope'
import { CampaignForm } from '@/components/finance/CampaignForm'

export default async function NewCampaignPage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">New campaign</h1>
      <CampaignForm churchId={churchId} />
    </div>
  )
}