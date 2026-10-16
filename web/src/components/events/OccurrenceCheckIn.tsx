'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, QrCode } from 'lucide-react'

/**
 * Member check-in for one occurrence of a recurring service. The database
 * trigger rejects anything before the service day, so this stays honest even if
 * the page is opened early.
 */
export function OccurrenceCheckIn({
  churchId,
  serviceId,
  serviceDate,
  membershipId,
  alreadyCheckedIn,
}: {
  churchId: string
  serviceId: string
  serviceDate: string
  membershipId: string
  alreadyCheckedIn: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    alreadyCheckedIn ? 'done' : 'idle'
  )
  const [message, setMessage] = useState('')

  async function checkIn() {
    setState('loading')
    setMessage('')
    const supabase = createClient()
    const { error } = await supabase.from('service_attendance').insert({
      church_id: churchId,
      recurring_service_id: serviceId,
      service_date: serviceDate,
      membership_id: membershipId,
      method: 'manual',
    })

    if (error) {
      setState('error')
      setMessage(
        error.code === '23505'
          ? 'You are already checked in for this service.'
          : error.message
      )
      return
    }

    setState('done')
    router.refresh()
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-primary/10 text-primary p-3 text-sm">
        <CheckCircle2 className="h-4 w-4" /> You are checked in. God bless!
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button onClick={checkIn} disabled={state === 'loading'}>
        {state === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <QrCode className="h-4 w-4 mr-2" />
        )}
        Check in to this service
      </Button>
      {state === 'error' && <p className="text-sm text-destructive">{message}</p>}
    </div>
  )
}
