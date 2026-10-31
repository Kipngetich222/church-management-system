'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  VOLUNTEER_CATEGORIES,
  VOLUNTEER_RECURRENCE,
  volunteerError,
  type VolunteerShift,
} from '@/lib/volunteers'

const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm'

export function ShiftForm({
  churchId,
  existing,
  roles,
  events,
}: {
  churchId: string
  existing?: VolunteerShift
  roles: { id: string; name: string }[]
  events: { id: string; title: string }[]
}) {
  const router = useRouter()
  const zone = existing?.timezone ?? 'Africa/Nairobi'
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    category: existing?.category ?? 'cleaning',
    role_id: existing?.role_id ?? '',
    event_id: existing?.event_id ?? '',
    starts_at: existing
      ? formatInTimeZone(existing.starts_at, zone, "yyyy-MM-dd'T'HH:mm")
      : '',
    ends_at: existing
      ? formatInTimeZone(existing.ends_at, zone, "yyyy-MM-dd'T'HH:mm")
      : '',
    timezone: zone,
    location: existing?.location ?? '',
    slots: existing?.slots == null ? '' : String(existing.slots),
    notes: existing?.notes ?? '',
    recurrence: existing?.recurrence ?? 'none',
    recurrence_until: existing?.recurrence_until ?? '',
    is_active: existing?.is_active ?? true,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      if (!form.title.trim() || !form.location.trim())
        throw new Error('An activity name and venue are required.')
      new Intl.DateTimeFormat('en', { timeZone: form.timezone }).format()
      const start = fromZonedTime(form.starts_at, form.timezone)
      const end = fromZonedTime(form.ends_at, form.timezone)
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end <= start
      )
        throw new Error('The end time must be after the start time.')
      if (
        form.recurrence !== 'none' &&
        form.starts_at.slice(0, 10) !== form.ends_at.slice(0, 10)
      )
        throw new Error(
          'Each recurring session must start and finish on the same day.'
        )
      if (
        form.recurrence !== 'none' &&
        form.recurrence_until &&
        form.recurrence_until < form.starts_at.slice(0, 10)
      )
        throw new Error(
          'The repeat-until date must be on or after the first session.'
        )
      const slots = form.slots.trim() ? Number(form.slots) : null
      if (slots !== null && (!Number.isInteger(slots) || slots < 1))
        throw new Error(
          'Enter a positive whole number for the participant limit, or leave it blank.'
        )
      const payload = {
        church_id: churchId,
        title: form.title.trim(),
        category: form.category,
        role_id: form.role_id || null,
        event_id: form.event_id || null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        timezone: form.timezone,
        location: form.location.trim(),
        slots,
        notes: form.notes.trim() || null,
        recurrence: form.recurrence,
        recurrence_until:
          form.recurrence === 'none' ? null : form.recurrence_until || null,
        is_active: form.is_active,
      }
      const supabase = createClient()
      const result = existing
        ? await supabase
            .from('volunteer_shifts')
            .update(payload)
            .eq('id', existing.id)
            .eq('church_id', churchId)
            .select('id')
            .single()
        : await supabase
            .from('volunteer_shifts')
            .insert(payload)
            .select('id')
            .single()
      if (result.error) throw result.error
      router.push('/admin/volunteers')
      router.refresh()
    } catch (err) {
      setError(volunteerError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          <div className="space-y-2">
            <Label htmlFor="activity-title">Activity name</Label>
            <Input
              id="activity-title"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Saturday church and compound cleaning"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-category">Type of work</Label>
              <select
                id="activity-category"
                className={selectClass}
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
              >
                {Object.entries(VOLUNTEER_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-recurrence">How often?</Label>
              <select
                id="activity-recurrence"
                className={selectClass}
                value={form.recurrence}
                onChange={(e) => update('recurrence', e.target.value)}
              >
                {Object.entries(VOLUNTEER_RECURRENCE).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-start">
                {form.recurrence === 'none'
                  ? 'Start date and time'
                  : 'First session starts'}
              </Label>
              <Input
                id="activity-start"
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => update('starts_at', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-end">
                {form.recurrence === 'none'
                  ? 'End date and time'
                  : 'First session ends'}
              </Label>
              <Input
                id="activity-end"
                type="datetime-local"
                required
                value={form.ends_at}
                onChange={(e) => update('ends_at', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-zone">Timezone</Label>
              <Input
                id="activity-zone"
                required
                value={form.timezone}
                onChange={(e) => update('timezone', e.target.value)}
                placeholder="Africa/Nairobi"
              />
              <p className="text-xs text-muted-foreground">
                All session times use this timezone.
              </p>
            </div>
            {form.recurrence !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="activity-until">Repeat until (optional)</Label>
                <Input
                  id="activity-until"
                  type="date"
                  min={form.starts_at.slice(0, 10)}
                  value={form.recurrence_until}
                  onChange={(e) => update('recurrence_until', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for an ongoing activity.
                </p>
              </div>
            )}
          </div>
          {form.recurrence !== 'none' && (
            <p className="rounded-md bg-muted p-3 text-sm">
              Members join the recurring activity until they cancel. Each
              session follows the time above. Weekly activities repeat on the
              first session&apos;s weekday; monthly activities use the same
              date, or the last day of a shorter month.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="activity-venue">Venue / meeting point</Label>
            <Input
              id="activity-venue"
              required
              maxLength={300}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Church compound, meet at the main gate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-notes">
              Description and what to bring
            </Label>
            <Textarea
              id="activity-notes"
              rows={4}
              maxLength={5000}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Describe the work, who can help, tools to bring, and any other requirements."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-slots">Participant limit (optional)</Label>
            <Input
              id="activity-slots"
              type="number"
              min={1}
              step={1}
              value={form.slots}
              onChange={(e) => update('slots', e.target.value)}
              placeholder="Unlimited participants"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to welcome everyone who wants to help.
            </p>
          </div>
          {(roles.length > 0 ||
            events.length > 0 ||
            existing?.role_id ||
            existing?.event_id) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activity-role">Volunteer role (optional)</Label>
                <select
                  id="activity-role"
                  className={selectClass}
                  value={form.role_id}
                  onChange={(e) => update('role_id', e.target.value)}
                >
                  <option value="">None</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-event">Linked event (optional)</Label>
                <select
                  id="activity-event"
                  className={selectClass}
                  value={form.event_id}
                  onChange={(e) => update('event_id', e.target.value)}
                >
                  <option value="">None</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
            />{' '}
            Open for participation
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Saving…'
                : existing
                  ? 'Save changes'
                  : 'Create activity'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => router.push('/admin/volunteers')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
