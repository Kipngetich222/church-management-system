'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setActiveChurch } from '@/lib/auth/active-church'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronsUpDown, LogOut, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { SidebarToggle } from './SidebarToggle'

type Membership = {
  church_id: string
  role: string
  churches: { id: string; name: string; plan: string | null } | null
}

export function MemberTopbar({
  isAdmin,
  memberships,
  activeChurchId,
}: {
  isAdmin: boolean
  memberships: Membership[]
  activeChurchId: string
}) {
  const router = useRouter()
  const active = memberships.find((m) => m.church_id === activeChurchId)
  const hasMultiple = memberships.length > 1

  function switchChurch(id: string) {
    setActiveChurch(id)
    window.location.assign('/member/home')
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center gap-1.5 border-b bg-background/80 px-3 backdrop-blur-md md:gap-2 md:px-6">
      <SidebarToggle />

      <div className="flex min-w-0 flex-1 items-center">
        {hasMultiple ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="min-w-0 gap-2" />}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                {active?.churches?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="truncate text-sm font-medium">
                {active?.churches?.name}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Your churches</DropdownMenuLabel>
              {memberships.map((m) => (
                <DropdownMenuItem
                  key={m.church_id}
                  onClick={() => switchChurch(m.church_id)}
                  className="flex justify-between"
                >
                  <span className="truncate">{m.churches?.name}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {m.role.replace('_', ' ')}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="truncate text-sm font-medium">
            {active?.churches?.name}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <ThemeToggle />
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            title="Admin view"
            onClick={() => {
              setActiveChurch(activeChurchId)
              router.push('/admin/dashboard')
              router.refresh()
            }}
          >
            <Shield className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">Admin view</span>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
          <LogOut className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}