'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01'])

/**
 * Hide (or restore) a single occurrence of a recurring service. Hiding a day
 * leaves the service intact but removes that date from the calendars - useful
 * when one week is cancelled without deleting the whole service.
 */
export function ServiceOccurrenceToggle({
  churchId,
  serviceId,
  date,
  hidden,
}: {
  churchId: string
  serviceId: string
  date: string
  hidden: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error: err } = hidden
      ? await supabase
          .from('service_exceptions')
          .delete()
          .eq('recurring_service_id', serviceId)
          .eq('service_date', date)
      : await supabase.from('service_exceptions').insert({
          church_id: churchId,
          recurring_service_id: serviceId,
          service_date: date,
        })

    if (err) {
      setError(
        err.code && MISSING_TABLE_CODES.has(err.code)
          ? 'Hiding single days is not set up on the database yet. Apply migration 0029_service_exceptions.sql.'
          : err.message
      )
      setBusy(false)
      return
    }

    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant={hidden ? 'default' : 'outline'}
        onClick={toggle}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : hidden ? (
          <Eye className="h-4 w-4 mr-2" />
        ) : (
          <EyeOff className="h-4 w-4 mr-2" />
        )}
        {hidden ? 'Restore this day' : 'Hide this day'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
