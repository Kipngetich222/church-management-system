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
    <header className="border-b bg-background/80 backdrop-blur-md flex h-14 items-center justify-between px-6">
      {hasMultiple ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" className="gap-2" />}
          >
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {active?.churches?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="text-sm font-medium">{active?.churches?.name}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Your churches</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.church_id}
                onClick={() => switchChurch(m.church_id)}
                className="flex justify-between"
              >
                <span>{m.churches?.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {m.role.replace('_', ' ')}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="text-sm font-medium">{active?.churches?.name}</span>
      )}

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveChurch(activeChurchId)
              router.push('/admin/dashboard')
              router.refresh()
            }}
          >
            <Shield className="h-4 w-4 mr-2" /> Admin view
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </header>
  )
}
