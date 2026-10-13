'use client'

import { ADMIN_NAV } from '@/lib/constants/admin-nav'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { AppSidebar } from './AppSidebar'

export function AdminSidebar({
  churchId,
  role,
  churchName,
  churchLogoUrl,
}: {
  churchId: string
  role: string
  churchName?: string
  churchLogoUrl?: string | null
}) {
  const { can, loading } = usePermissions(churchId, role)
  const items = ADMIN_NAV.filter(
    (item) => !item.permission || can(item.permission)
  )

  return (
    <AppSidebar
      items={items}
      title={churchName}
      logoUrl={churchLogoUrl}
      loading={loading}
    />
  )
}