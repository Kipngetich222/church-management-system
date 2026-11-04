'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function VisitorRefresh() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === 'visible' &&
        !document.activeElement?.matches(
          'input, textarea, select, [contenteditable="true"]'
        )
      )
        router.refresh()
    }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router])
  return null
}
