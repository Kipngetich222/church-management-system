'use client'

import { MEMBER_NAV } from '@/lib/constants/member-nav'
import { AppSidebar } from './AppSidebar'

export function MemberSidebar({
  churchName,
  churchLogoUrl,
}: {
  churchName?: string
  churchLogoUrl?: string | null
}) {
  return (
    <AppSidebar
      items={MEMBER_NAV}
      title={churchName}
      logoUrl={churchLogoUrl}
    />
  )
}