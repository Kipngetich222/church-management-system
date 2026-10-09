'use client'

import { useRouter } from 'next/navigation'
// import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronsUpDown } from 'lucide-react'

type Church = { id: string; name: string; plan: string }

type Membership = {
  church_id: string
  role: string
  churches: Church | Church[] | null
}

function firstChurch(churches: Membership['churches']): Church | null {
  if (!churches) return null
  return Array.isArray(churches) ? (churches[0] ?? null) : churches
}

export function ChurchSwitcher({
  memberships,
  activeChurchId,
}: {
  memberships: Membership[]
  activeChurchId: string
}) {
  const router = useRouter()
  const active = memberships.find((m) => m.church_id === activeChurchId)
  const activeChurch = firstChurch(active?.churches ?? null)

  function switchChurch(id: string) {
    localStorage.setItem('active_church_id', id)
    router.refresh()
    // Optionally push to dashboard to force re-fetch
    router.push('/admin/dashboard')
  }

  if (memberships.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="gap-2" />}
      >
        {activeChurch?.name ?? 'Select church'}
        <ChevronsUpDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((m) => {
          const church = firstChurch(m.churches)
          return (
            <DropdownMenuItem
              key={m.church_id}
              onClick={() => switchChurch(m.church_id)}
            >
              <div className="flex flex-col">
                <span>{church?.name}</span>
                <span className="text-xs text-muted-foreground">{m.role}</span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
