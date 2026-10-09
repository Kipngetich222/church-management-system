'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

export function PrayerRequestDetail({ request }: { request: any }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const [status, setStatus] = useState(request.status)
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!note.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user!.id)
      .eq('church_id', request.church_id)
      .single()

    await supabase.from('prayer_interactions').insert({
      request_id: request.id,
      author_membership_id: membership!.id,
      body: note,
      is_internal: internal,
    })
    setNote('')
    setSaving(false)
    router.refresh()
  }

  async function updateStatus(newStatus: string) {
    const supabase = createClient()
    await supabase
      .from('prayer_requests')
      .update({ status: newStatus as 'open' | 'in_progress' | 'closed' | 'answered' })
      .eq('id', request.id)
    setStatus(newStatus)
    router.refresh()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {request.title}
            <Select value={status} onValueChange={updateStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="answered">Answered</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{request.body}</p>
          <div className="text-xs text-muted-foreground">
            {request.church_memberships?.users?.full_name ?? 'Anonymous'} ·{' '}
            {format(new Date(request.created_at), 'MMM d, yyyy')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(request.prayer_interactions ?? []).map((i: any) => (
            <div key={i.id} className={`border-l-2 pl-3 ${i.is_internal ? 'border-amber-500' : 'border-primary/40'}`}>
              <p className="text-sm">{i.body}</p>
              <p className="text-xs text-muted-foreground">
                {i.church_memberships?.users?.full_name ?? 'Staff'} ·{' '}
                {format(new Date(i.created_at), 'MMM d, h:mm a')}
                {i.is_internal && ' · internal'}
              </p>
            </div>
          ))}

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note or prayer response..."
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Checkbox id="internal" checked={internal} onCheckedChange={(v) => setInternal(!!v)} />
            <Label htmlFor="internal">Internal note (not visible to member)</Label>
          </div>
          <Button onClick={addNote} disabled={saving || !note.trim()}>
            {saving ? 'Saving...' : 'Add note'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

