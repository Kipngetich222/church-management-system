'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { volunteerError } from '@/lib/volunteers'
import { changeVolunteerParticipation } from '@/lib/volunteer-signups'

export function SignUpShiftButton({
  shiftId,
  membershipId,
  signedUp,
  signupId,
  full,
  closed,
}: {
  shiftId: string
  membershipId: string
  signedUp: boolean
  signupId: string | null
  full: boolean
  closed: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function toggle() {
    if (busy || pending) return
    setBusy(true)
    setError('')
    try {
      await changeVolunteerParticipation(createClient(), {
        shiftId,
        membershipId,
        signedUp,
        signupId,
      })
      startTransition(() => router.refresh())
    } catch (err) {
      setError(volunteerError(err))
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        onClick={toggle}
        disabled={busy || pending || (!signedUp && (full || closed))}
        variant={signedUp ? 'outline' : 'default'}
        className="w-full"
      >
        {busy || pending
          ? 'Updating…'
          : signedUp
            ? 'Cancel participation'
            : closed
              ? 'Sign-ups closed'
              : full
                ? 'Activity full'
                : 'Participate'}
      </Button>
    </div>
  )
}
