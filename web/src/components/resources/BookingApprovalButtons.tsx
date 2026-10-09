'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2 } from 'lucide-react'

export function BookingApprovalButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)

  async function decide(status: 'approved' | 'rejected') {
    setBusy(status === 'approved' ? 'approve' : 'reject')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('resource_bookings')
      .update({ status, approved_by: user!.id })
      .eq('id', bookingId)
    router.refresh()
    setBusy(null)
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decide('approved')} disabled={!!busy}>
        {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Check className="h-4 w-4 mr-1" /> Approve</>)}
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide('rejected')} disabled={!!busy}>
        {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><X className="h-4 w-4 mr-1" /> Reject</>)}
      </Button>
    </div>
  )
}