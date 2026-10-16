'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, QrCode } from 'lucide-react'

export function EventCheckIn({ eventId }: { eventId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function checkIn() {
    setState('loading')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setState('error')
      setMessage('Please sign in again to check in.')
      return
    }

    const { data: event } = await supabase
      .from('events')
      .select('church_id')
      .eq('id', eventId)
      .single()

    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('church_id', event!.church_id)
      .maybeSingle()

    if (!membership) {
      setState('error')
      setMessage('You are not a member of this church.')
      return
    }

    const { error } = await supabase.from('event_attendance').insert({
      event_id: eventId,
      membership_id: membership.id,
      method: 'manual',
    })

    if (error) {
      setState('error')
      setMessage(error.message)
      return
    }
    setState('done')
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
        Check in to this event
      </Button>
      {state === 'error' && (
        <p className="text-sm text-destructive">{message}</p>
      )}
    </div>
  )
}
