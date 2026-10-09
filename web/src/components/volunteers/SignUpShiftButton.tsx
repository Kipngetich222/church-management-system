'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignUpShiftButton({
  shiftId,
  membershipId,
  signedUp,
  full,
}: {
  shiftId: string
  membershipId: string
  signedUp: boolean
  full: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    const supabase = createClient()
    if (signedUp) {
      await supabase
        .from('volunteer_signups')
        .delete()
        .eq('shift_id', shiftId)
        .eq('membership_id', membershipId)
    } else {
      await supabase
        .from('volunteer_signups')
        .insert({ shift_id: shiftId, membership_id: membershipId })
    }
    router.refresh()
    setBusy(false)
  }

  return (
    <Button
      onClick={toggle}
      disabled={busy || (!signedUp && full)}
      variant={signedUp ? 'outline' : 'default'}
      className="w-full"
    >
      {busy ? '...' : signedUp ? 'Cancel signup' : full ? 'Full' : 'Sign up'}
    </Button>
  )
}