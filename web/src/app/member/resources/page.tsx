import { getActiveChurch } from '@/lib/utils/church-scope'
import { listResources } from '@/lib/services/resources.service'
import { ResourceLibrary } from '@/components/resources/ResourceLibrary'

export default async function MemberResourcesPage() {
  const { churchId } = await getActiveChurch()
  const resources = await listResources(churchId)
  return <ResourceLibrary churchId={churchId} resources={resources} />
}
