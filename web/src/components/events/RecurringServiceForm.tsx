'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  WEEKDAY_LABELS,
  type RecurringServiceRow,
  type ServiceTime,
} from '@/lib/constants/services'
import type { EventVisibility } from '@/lib/constants/events'

const DEFAULT_TIME: ServiceTime = { label: '1st Service', start: '09:00', end: '11:00' }

export function RecurringServiceForm({
  churchId,
  existing,
}: {
  churchId: string
  existing?: RecurringServiceRow | null
}) {
  const router = useRouter()
  const [title, setTitle] = useState(existing?.title ?? 'Sunday Service')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [procedure, setProcedure] = useState(existing?.procedure ?? '')
  const [dayOfWeek, setDayOfWeek] = useState(String(existing?.day_of_week ?? 0))
  const [times, setTimes] = useState<ServiceTime[]>(
    existing?.times?.length ? existing.times : [{ ...DEFAULT_TIME }]
  )
  const [locationName, setLocationName] = useState(existing?.location_name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [visibility, setVisibility] = useState<string>(existing?.visibility ?? 'members_only')
  const [startDate, setStartDate] = useState(existing?.start_date ?? '')
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateTime(index: number, patch: Partial<ServiceTime>) {
    setTimes((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Give the service a name.')
      return
    }

    const cleanTimes = times
      .filter((t) => t.start)
      .map((t) => ({ label: t.label || 'Service', start: t.start, end: t.end || null }))

    if (cleanTimes.length === 0) {
      setError('Add at least one service time.')
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      church_id: churchId,
      title: title.trim(),
      description: description.trim() || null,
      procedure: procedure.trim() || null,
      day_of_week: Number(dayOfWeek),
      times: cleanTimes,
      location_name: locationName.trim() || null,
      address: address.trim() || null,
      visibility: visibility as EventVisibility,
      is_active: isActive,
      start_date: startDate || null,
      end_date: endDate || null,
    }

    const { error: err } = existing
      ? await supabase.from('recurring_services').update(payload).eq('id', existing.id)
      : await supabase.from('recurring_services').insert(payload)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    router.push('/admin/events/recurring')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Service details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sunday Service"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Repeats every</Label>
              <Select value={dayOfWeek} onValueChange={(v) => setDayOfWeek(v ?? '0')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, index) => (
                    <SelectItem key={label} value={String(index)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Who can see it</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v ?? 'members_only')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="members_only">Members of the church</SelectItem>
                  <SelectItem value="all_members">All members</SelectItem>
                  <SelectItem value="public">Public - anyone with the link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="procedure">Nature / order of service</Label>
            <Textarea
              id="procedure"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              rows={4}
              placeholder="Welcome, praise & worship, word, offering, announcements..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Services & times</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTimes((prev) => [...prev, { label: 'Service', start: '11:00', end: '' }])}
          >
            <Plus className="h-4 w-4 mr-2" /> Add service
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {times.map((t, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 flex-1 min-w-[140px]">
                <Label>Label</Label>
                <Input
                  value={t.label}
                  onChange={(e) => updateTime(i, { label: e.target.value })}
                  placeholder="1st Service"
                />
              </div>
              <div className="space-y-2">
                <Label>Starts</Label>
                <Input type="time" value={t.start} onChange={(e) => updateTime(i, { start: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ends</Label>
                <Input type="time" value={t.end ?? ''} onChange={(e) => updateTime(i, { end: e.target.value })} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTime(i)}
                disabled={times.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>When & where</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Starts from (optional)</Label>
              <Input id="start" type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Until (optional)</Label>
              <Input id="end" type="date" value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Main sanctuary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            Active - show it on the calendar
          </label>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
            </>
          ) : existing ? (
            'Save changes'
          ) : (
            'Create service'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
