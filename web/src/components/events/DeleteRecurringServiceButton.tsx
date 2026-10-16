'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2 } from 'lucide-react'

/**
 * Delete a recurring service entirely. Programmes and check-in history for the
 * service are removed too (database cascade), so this is confirmed first.
 */
export function DeleteRecurringServiceButton({
  serviceId,
  title,
}: {
  serviceId: string
  title: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    const ok = window.confirm(
      `Delete "${title}"? This removes the service, its programmes and its check-in history. This cannot be undone.`
    )
    if (!ok) return

    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('recurring_services')
      .delete()
      .eq('id', serviceId)

    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }

    router.push('/admin/events/recurring')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4 mr-2" />
        )}
        Delete service
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
