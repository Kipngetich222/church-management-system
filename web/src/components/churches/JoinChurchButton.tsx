'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setActiveChurch } from '@/lib/auth/active-church'

/**
 * Join an existing church straight from its public profile. Works for signed-in
 * members who already belong to another church (the onboarding wizard only
 * handles people with no memberships yet).
 */
export function JoinChurchButton({
  churchId,
  className,
}: {
  churchId: string
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function join() {
    if (busy) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/churches/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ churchId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(false)
      setError(data.error ?? 'Could not join this church')
      return
    }
    setActiveChurch(churchId)
    router.push((data.path as string) ?? '/member/home')
    router.refresh()
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button size="lg" onClick={join} disabled={busy} className={className}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        Join this church
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}