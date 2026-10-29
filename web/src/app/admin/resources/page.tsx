import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/guard'
import { isAdminRole } from '@/lib/auth/redirect'
import { listResources } from '@/lib/services/resources.service'
import { ResourceLibrary } from '@/components/resources/ResourceLibrary'

export default async function ResourcesPage() {
  const { churchId, role } = await requirePermission('resources:*')
  if (!isAdminRole(role)) redirect('/member/resources')
  const resources = await listResources(churchId)
  return <ResourceLibrary churchId={churchId} resources={resources} canManage />
}
