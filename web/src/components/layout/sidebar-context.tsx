'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

const STORAGE_KEY = 'churchms-sidebar-collapsed'
const CHANGE_EVENT = 'churchms-sidebar-change'

let fallbackCollapsed = false

function getCollapsedSnapshot() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // Fall back to the in-memory value when storage is unavailable.
  }
  return fallbackCollapsed
}

function getCollapsedServerSnapshot() {
  return false
}

function subscribeToCollapsed(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

type SidebarContextValue = {
  /** Desktop rail collapsed to icons only. */
  collapsed: boolean
  toggleCollapsed: () => void
  /** Off-canvas drawer shown on small screens. */
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapsed = useSyncExternalStore(
    subscribeToCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  )

  const toggleCollapsed = useCallback(() => {
    const next = !getCollapsedSnapshot()
    fallbackCollapsed = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Storage may be unavailable; the rail still toggles in-session.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const setMobileOpenStable = useCallback((open: boolean) => {
    setMobileOpen(open)
  }, [])

  // Lock background scrolling while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen: setMobileOpenStable }),
    [collapsed, toggleCollapsed, mobileOpen, setMobileOpenStable]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
