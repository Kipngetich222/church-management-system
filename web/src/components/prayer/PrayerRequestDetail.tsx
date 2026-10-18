'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import {
  firstRelation,
  type PrayerInteractionRow,
  type PrayerRequestRow,
} from '@/lib/types/prayer'

const PRAYER_STATUSES = ['open', 'in_progress', 'answered', 'closed'] as const
const COUNSELLING_STATUSES = ['open', 'in_progress', 'closed'] as const

function audienceLabel(request: PrayerRequestRow) {
  if (request.type === 'counseling') return 'Counselling'
  if (request.audience === 'church') return 'Whole church'
  if (request.audience === 'person') return 'Specific leader'
  return 'Pastors & leaders'
}

function interactionAuthor(interaction: PrayerInteractionRow) {
  const membership = firstRelation(interaction.church_memberships)
  return firstRelation(membership?.users)?.full_name ?? 'Staff'
}

export function PrayerRequestDetail({
  request,
}: {
  request: PrayerRequestRow
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const [status, setStatus] = useState(request.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isCounselling = request.type === 'counseling'
  const statuses = isCounselling ? COUNSELLING_STATUSES : PRAYER_STATUSES
  const assignedMembership = firstRelation(request.assigned_membership)
  const assignedUser = firstRelation(assignedMembership?.users)
  const assignedName = assignedUser?.full_name ?? assignedUser?.email ?? null
  const authorMembership = firstRelation(request.church_memberships)
  const authorName =
    firstRelation(authorMembership?.users)?.full_name ?? 'Anonymous'

  async function addNote() {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user!.id)
      .eq('church_id', request.church_id!)
      .single()

    const { error: insertError } = await supabase
      .from('prayer_interactions')
      .insert({
        request_id: request.id,
        author_membership_id: membership!.id,
        body: note.trim(),
        is_internal: internal,
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

  async function updateStatus(newStatus: string | null) {
    if (!newStatus) return
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('prayer_requests')
      .update({
        status: newStatus as 'open' | 'in_progress' | 'closed' | 'answered',
      })
      .eq('id', request.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setStatus(newStatus)
    router.refresh()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>{request.title}</span>
            <Select value={status} onValueChange={updateStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'answered'
                      ? 'Answered / addressed'
                      : option.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{audienceLabel(request)}</Badge>
            <Badge variant="secondary">{status.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap text-sm">{request.body}</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              From: {authorName} ·{' '}
              {format(new Date(request.created_at), 'MMM d, yyyy')}
            </p>
            {request.audience === 'person' && (
              <p>Channelled to: {assignedName ?? 'A pastor or leader'}</p>
            )}
          </div>

          {(status === 'open' || status === 'in_progress') && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  updateStatus(isCounselling ? 'closed' : 'answered')
                }
              >
                {isCounselling
                  ? 'Close counselling request'
                  : 'Mark as addressed'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(request.prayer_interactions ?? []).map(
            (interaction: PrayerInteractionRow) => (
              <div
                key={interaction.id}
                className={`border-l-2 pl-3 ${
                  interaction.is_internal
                    ? 'border-amber-500'
                    : 'border-primary/40'
                }`}
              >
                <p className="text-sm">{interaction.body}</p>
                <p className="text-xs text-muted-foreground">
                  {interactionAuthor(interaction)} ·{' '}
                  {format(new Date(interaction.created_at), 'MMM d, h:mm a')}
                  {interaction.is_internal && ' · internal'}
                </p>
              </div>
            )
          )}

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isCounselling
                ? 'Add a confidential follow-up note...'
                : 'Add a note or prayer response...'
            }
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="internal"
              checked={internal}
              onCheckedChange={(v) => setInternal(!!v)}
            />
            <Label htmlFor="internal">
              Internal note (not visible to member)
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={addNote} disabled={saving || !note.trim()}>
            {saving ? 'Saving...' : 'Add note'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
