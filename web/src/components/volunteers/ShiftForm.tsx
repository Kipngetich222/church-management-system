'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Existing = {
  id: string
  title: string
  role_id: string | null
  starts_at: string
  ends_at: string
  location: string | null
  slots: number
  notes: string | null
  event_id: string | null
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ShiftForm({
  churchId,
  existing,
}: {
  churchId: string
  existing?: Existing
}) {
  const router = useRouter()
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [events, setEvents] = useState<{ id: string; title: string }[]>([])
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    role_id: existing?.role_id ?? '',
    starts_at: toLocalInput(existing?.starts_at ?? null),
    ends_at: toLocalInput(existing?.ends_at ?? null),
    location: existing?.location ?? '',
    slots: existing?.slots ? String(existing.slots) : '1',
    notes: existing?.notes ?? '',
    event_id: existing?.event_id ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('volunteer_roles')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name')
      .then(({ data }) => setRoles(data ?? []))

    supabase
      .from('events')
      .select('id, title, start_time')
      .eq('church_id', churchId)
      .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('start_time')
      .limit(50)
      .then(({ data }) => setEvents(data ?? []))
  }, [churchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!form.starts_at || !form.ends_at) {
      setError('Start and end times are required')
      setLoading(false)
      return
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError('End time must be after start time')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const payload = {
      church_id: churchId,
      title: form.title,
      role_id: form.role_id || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      location: form.location || null,
      slots: parseInt(form.slots) || 1,
      notes: form.notes || null,
      event_id: form.event_id || null,
    }

    const { error: err } = existing
      ? await supabase.from('volunteer_shifts').update(payload).eq('id', existing.id)
      : await supabase.from('volunteer_shifts').insert(payload)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/admin/volunteers')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Shift title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Sunday Service — Ushering"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role_id}
                onValueChange={(v) => setForm({ ...form, role_id: v ?? '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Linked event (optional)</Label>
              <Select
                value={form.event_id}
                onValueChange={(v) => setForm({ ...form, event_id: v ?? '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Starts at</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Ends at</Label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Slots</Label>
              <Input
                type="number"
                min="1"
                value={form.slots}
                onChange={(e) => setForm({ ...form, slots: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Main Sanctuary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="What should volunteers know?"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : existing ? 'Save changes' : 'Create shift'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
