'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function BookingCancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function cancel() {
    if (!confirm('Cancel this booking?')) return
    setBusy(true)
    const supabase = createClient()
    await supabase
      .from('resource_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
    router.refresh()
    setBusy(false)
  }

  return (
    <Button variant="ghost" size="sm" onClick={cancel} disabled={busy} className="w-full">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel booking'}
    </Button>
  )
}