'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function MemberRequestActions({
  requestId,
  membershipId,
  kind,
  status,
}: {
  requestId: string
  membershipId: string
  kind: 'prayer' | 'counseling'
  status: string
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isActive = status === 'open' || status === 'in_progress'

  async function addReply() {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: insertError } = await supabase
      .from('prayer_interactions')
      .insert({
        request_id: requestId,
        author_membership_id: membershipId,
        body: note.trim(),
        is_internal: false,
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setNote('')
    setSaving(false)
    router.refresh()
  }

  async function markAddressed() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('prayer_requests')
      .update({ status: kind === 'prayer' ? 'answered' : 'closed' })
      .eq('id', requestId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    router.refresh()
  }

  if (!isActive) return null

  return (
    <div className="space-y-3 border-t pt-3">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Write a reply or prayer note..."
        rows={2}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={addReply}
          disabled={saving || !note.trim()}
        >
          {saving ? 'Saving...' : 'Send reply'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={markAddressed}
          disabled={saving}
        >
          {kind === 'prayer' ? 'Mark as addressed' : 'Close request'}
        </Button>
      </div>
    </div>
  )
}
