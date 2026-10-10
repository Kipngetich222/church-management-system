'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from './sidebar-context'

export type SidebarNavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  section?: string
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarNav({
  items,
  collapsed,
  onNavigate,
}: {
  items: SidebarNavItem[]
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const sections = Array.from(new Set(items.map((item) => item.section ?? '')))

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto p-3">
      {sections.map((section) => (
        <div key={section || 'default'}>
          {section && !collapsed ? (
            <p className="mb-2 px-3 text-xs tracking-wider text-muted-foreground uppercase">
              {section}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {items
              .filter((item) => (item.section ?? '') === section)
              .map((item) => {
                const Icon = item.icon
                const active = isActive(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        collapsed && 'justify-center px-2',
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          active
                            ? 'text-primary'
                            : 'text-primary/50 group-hover:text-primary'
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
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

function SidebarBrand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 font-bold text-primary">
        ✝
      </span>
      <span className="truncate font-bold">ChurchMS</span>
    </Link>
  )
}

export function AppSidebar({
  items,
  title,
  loading = false,
}: {
  items: SidebarNavItem[]
  title?: string
  loading?: boolean
}) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const pathname = usePathname()

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, setMobileOpen])

  const nav = loading ? (
    <div className="flex-1 space-y-2 p-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-8 animate-pulse rounded-md bg-muted/60" />
      ))}
    </div>
  ) : (
    <SidebarNav items={items} collapsed={collapsed} />
  )

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'relative z-20 hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md transition-[width] duration-300 ease-out md:sticky md:top-0 md:flex md:h-screen',
          collapsed ? 'w-[80px]' : 'w-[260px]'
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b',
            collapsed ? 'justify-center px-2' : 'gap-2 px-3'
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : (
            <>
              <SidebarBrand />
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {title && !collapsed && (
          <p className="shrink-0 truncate px-4 pt-3 text-xs text-muted-foreground">
            {title}
          </p>
        )}

        {nav}
      </aside>

      {/* Mobile off-canvas drawer */}
      <div
        aria-hidden
        onClick={() => setMobileOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        aria-label="Navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-300 ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarBrand />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {title && (
          <p className="shrink-0 truncate px-4 pt-3 text-xs text-muted-foreground">
            {title}
          </p>
        )}

        {loading ? (
          <div className="flex-1 space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : (
          <SidebarNav
            items={items}
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        )}
      </aside>
    </>
  )
}