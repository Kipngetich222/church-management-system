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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { ChevronsUpDown, LogOut, User, Shield, UserCircle2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/theme-toggle'

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
    <header className="border-b bg-background/80 backdrop-blur-md flex h-14 items-center justify-between px-6">
      {/* Church switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="gap-2" />}
        >
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {active?.churches?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-sm font-medium">{active?.churches?.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
            {active?.churches?.plan}
          </span>
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

      {/* Role switch + user menu */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={switchToMemberView}
          className="gap-2"
        >
          <UserCircle2 className="h-4 w-4" />
          Member view
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
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user.full_name ?? 'Admin'}</span>
                <span className="text-xs text-muted-foreground font-normal">
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
