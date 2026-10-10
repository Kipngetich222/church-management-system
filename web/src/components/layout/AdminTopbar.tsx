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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronsUpDown, LogOut, User, Shield, UserCircle2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { SidebarToggle } from './SidebarToggle'

type Props = {
  user: { email: string; full_name: string | null; avatar_url: string | null }
  memberships: Array<{
    church_id: string
    role: string
    churches: { id: string; name: string; plan: string | null } | null
  }>
  activeChurchId: string
}

export function AdminTopbar({ user, memberships, activeChurchId }: Props) {
  const router = useRouter()
  const active = memberships.find((m) => m.church_id === activeChurchId)

  function switchChurch(id: string) {
    setActiveChurch(id)
    // Full navigation so server components re-resolve the active church.
    window.location.assign('/admin/dashboard')
  }

  function switchToMemberView() {
    setActiveChurch(activeChurchId)
    router.push('/member/home')
    router.refresh()
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = (user.full_name || user.email).slice(0, 2).toUpperCase()

  return (
    <header className="flex h-14 items-center gap-1.5 border-b bg-background/80 px-3 backdrop-blur-md md:gap-2 md:px-6">
      <SidebarToggle />

      {/* Church switcher */}
      <div className="flex min-w-0 flex-1 items-center">
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
            <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize md:inline-block">
              {active?.churches?.plan}
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
      </div>

      {/* Role switch + user menu */}
      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={switchToMemberView}
          className="gap-2"
          title="Member view"
        >
          <UserCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline">Member view</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" />
            }
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-sm font-normal text-foreground">
              <div className="flex flex-col">
                <span className="truncate font-medium">
                  {user.full_name ?? 'Admin'}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/admin/settings/church-profile')}
            >
              <Shield className="h-4 w-4 mr-2" /> Church settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/member/profile')}>
              <User className="h-4 w-4 mr-2" /> My profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}