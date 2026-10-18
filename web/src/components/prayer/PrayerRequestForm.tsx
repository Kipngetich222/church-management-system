'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2 } from 'lucide-react'
import type { PrayerTarget } from '@/lib/services/prayer.service'

export type PrayerRequestKind = 'prayer' | 'counseling'
type PrayerVisibility = 'pastors_only' | 'public_anonymous' | 'public_named'

const PRAYER_CATEGORIES = [
  ['general', 'General'],
  ['health', 'Health'],
  ['family', 'Family'],
  ['finances', 'Finances'],
  ['work', 'Work'],
  ['spiritual', 'Spiritual'],
] as const

const COUNSELLING_CATEGORIES = [
  ['general', 'General'],
  ['marriage', 'Marriage & relationships'],
  ['family', 'Family'],
  ['grief', 'Grief & loss'],
  ['addiction', 'Addiction'],
  ['mental_health', 'Mental health'],
  ['finances', 'Finances'],
  ['spiritual', 'Spiritual'],
] as const

export function PrayerRequestForm({
  churchId,
  membershipId,
  kind,
  targets,
}: {
  churchId: string
  membershipId: string
  kind: PrayerRequestKind
  targets: PrayerTarget[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    category: 'general',
    title: '',
    body: '',
    audience: kind === 'counseling' ? 'person' : 'leaders',
    assignedTo: '',
    visibility: 'pastors_only' as PrayerVisibility,
  })
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState('')

  const categories =
    kind === 'prayer' ? PRAYER_CATEGORIES : COUNSELLING_CATEGORIES
  const audience = kind === 'counseling' ? 'person' : form.audience
  const needsPerson = audience === 'person'
  const visibility: PrayerVisibility =
    kind === 'counseling' || audience !== 'church'
      ? 'pastors_only'
      : form.visibility

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.body.trim()) {
      setError('Please fill in a title and the details.')
      return
    }

    if (needsPerson && !form.assignedTo) {
      setError(
        kind === 'counseling'
          ? 'Choose the pastor or leader you would like to speak with.'
          : 'Choose the pastor or leader you would like to send this to.'
      )
      return
    }

    setState('saving')
    const supabase = createClient()
    const { error: err } = await supabase.from('prayer_requests').insert({
      church_id: churchId,
      membership_id: membershipId,
      type: kind,
      category: form.category,
      title: form.title.trim(),
      body: form.body.trim(),
      audience,
      assigned_to: needsPerson ? form.assignedTo : null,
      visibility,
    })

    if (err) {
      setError(err.message)
      setState('idle')
      return
    }

    setState('done')
    router.refresh()
  }

  function reset() {
    setForm({
      category: 'general',
      title: '',
      body: '',
      audience: kind === 'counseling' ? 'person' : 'leaders',
      assignedTo: '',
      visibility: 'pastors_only',
    })
    setError('')
    setState('idle')
  }

  if (state === 'done') {
    return (
      <div className="space-y-4 py-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <div className="font-medium">
          {kind === 'prayer'
            ? 'Prayer request sent'
            : 'Counselling request sent'}
        </div>
        <p className="text-sm text-muted-foreground">
          {kind === 'prayer'
            ? audience === 'church'
              ? 'Your church can now pray with you.'
              : audience === 'person'
                ? 'The pastor or leader you chose can now see your request.'
                : 'Your pastors and leaders can now see your request.'
            : 'The pastor or leader you chose can now see your confidential request.'}
        </p>
        <Button type="button" variant="outline" onClick={reset}>
          Send another
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${kind}-title`}>
          {kind === 'prayer' ? 'Title' : 'What would you like to talk about?'}
        </Label>
        <Input
          id={`${kind}-title`}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={
            kind === 'prayer'
              ? 'e.g. Praying for my family'
              : 'e.g. A private conversation'
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={form.category}
          onValueChange={(v) => setForm({ ...form, category: v ?? 'general' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${kind}-details`}>Details</Label>
        <Textarea
          id={`${kind}-details`}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder={
            kind === 'prayer'
              ? 'Share what you would like prayer for...'
              : 'Share what is on your heart. This stays confidential with the person you choose.'
          }
          rows={5}
          required
        />
      </div>

      {kind === 'prayer' ? (
        <div className="space-y-2">
          <Label>Who should receive this?</Label>
          <Select
            value={form.audience}
            onValueChange={(v) =>
              setForm({
                ...form,
                audience: v ?? 'leaders',
                assignedTo: '',
                visibility: 'pastors_only',
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="church">The whole church</SelectItem>
              <SelectItem value="leaders">All pastors & leaders</SelectItem>
              <SelectItem value="person">
                A specific pastor or leader
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          Counselling requests are confidential. They are visible to the pastor
          or leader you choose and to church leadership.
        </div>
      )}

      {kind === 'prayer' && audience === 'church' && (
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select
            value={form.visibility}
            onValueChange={(v) =>
              setForm({
                ...form,
                visibility: (v ?? 'pastors_only') as PrayerVisibility,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pastors_only">
                Church members only (not public)
              </SelectItem>
              <SelectItem value="public_anonymous">
                Public prayer wall (anonymous)
              </SelectItem>
              <SelectItem value="public_named">
                Public prayer wall (with my name)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Public requests appear on the prayer wall for seven days or until
            they are marked as addressed.
          </p>
        </div>
      )}

      {needsPerson && (
        <div className="space-y-2">
          <Label>
            {kind === 'counseling' ? 'Choose a pastor or leader' : 'Send to'}
          </Label>
          <Select
            value={form.assignedTo}
            onValueChange={(v) => setForm({ ...form, assignedTo: v ?? '' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a pastor or leader" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.name} — {target.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {targets.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No pastor or leader accounts are available yet. Please contact
              your church admin.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={state === 'saving' || (needsPerson && targets.length === 0)}
      >
        {state === 'saving'
          ? 'Sending...'
          : kind === 'prayer'
            ? 'Send prayer request'
            : 'Request counselling'}
      </Button>
    </form>
  )
}
