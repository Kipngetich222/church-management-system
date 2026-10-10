'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSidebar } from './sidebar-context'

export function SidebarToggle({ className }: { className?: string }) {
  const { setMobileOpen } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Open navigation"
      title="Open navigation"
      onClick={() => setMobileOpen(true)}
      className={cn('md:hidden', className)}
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}