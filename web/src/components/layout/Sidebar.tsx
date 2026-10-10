'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV } from '@/lib/constants/admin-nav'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useChurch } from '@/lib/hooks/useChurch'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()
  const { church } = useChurch()
  const { can, loading } = usePermissions(church?.id, (church as any)?.role)

  const visible = ADMIN_NAV.filter((item) => !item.permission || can(item.permission))
  const sections = Array.from(new Set(visible.map((n) => n.section)))

  if (loading) return null

  return (
    <nav className="flex-1 overflow-y-auto p-4 space-y-6">
      {sections.map((section) => (
        <div key={section}>
          <p className="text-xs uppercase text-muted-foreground px-3 mb-2 tracking-wider">
            {section}
          </p>
          <ul className="space-y-0.5">
            {visible.filter((n) => n.section === section).map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        active
                          ? 'text-primary'
                          : 'text-primary/50 group-hover:text-primary'
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}