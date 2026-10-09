'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PosterUpload } from './PosterUpload'
import { MapPicker } from '@/components/maps/MapPicker'
import { slugify } from '@/lib/utils/slug'

type Existing = {
  id: string
  title: string
  slug: string
  description: string | null
  start_time: string
  end_time: string | null
  all_day: boolean
  location_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  poster_url: string | null
  capacity: number | null
  status: string
  visibility: string
  is_registration_required: boolean
  registration_deadline: string | null
  price: number | null
  currency: string
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventForm({
  churchId,
  existing,
}: {
  churchId: string
  existing?: Existing
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    slug: existing?.slug ?? '',
    description: existing?.description ?? '',
    start_time: toLocalInput(existing?.start_time ?? null),
    end_time: toLocalInput(existing?.end_time ?? null),
    all_day: existing?.all_day ?? false,
    location_name: existing?.location_name ?? '',
    address: existing?.address ?? '',
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
    poster_url: existing?.poster_url ?? '',
    capacity: existing?.capacity ? String(existing.capacity) : '',
    status: existing?.status ?? 'published',
    visibility: existing?.visibility ?? 'public',
    is_registration_required: existing?.is_registration_required ?? false,
    registration_deadline: toLocalInput(existing?.registration_deadline ?? null),
    price: existing?.price != null ? String(existing.price) : '0',
    currency: existing?.currency ?? 'KES',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const payload = {
      church_id: churchId,
      title: form.title,
      slug: form.slug || slugify(form.title),
      description: form.description || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      all_day: form.all_day,
      location_name: form.location_name || null,
      address: form.address || null,
      latitude: form.latitude,
      longitude: form.longitude,
      poster_url: form.poster_url || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      status: form.status as 'draft' | 'published' | 'cancelled' | 'completed',
      visibility: form.visibility as 'public' | 'members_only',
      is_registration_required: form.is_registration_required,
      registration_deadline: form.registration_deadline
        ? new Date(form.registration_deadline).toISOString()
        : null,
      price: parseFloat(form.price) || 0,
      currency: form.currency,
    }

    const { error: err } = existing
      ? await supabase.from('events').update(payload).eq('id', existing.id)
      : await supabase.from('events').insert(payload).select('id').single()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/admin/events')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Event title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                    slug: existing ? form.slug : slugify(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>URL slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="easter-sunday-service"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <PosterUpload
            churchId={churchId}
            currentUrl={form.poster_url}
            onUploaded={(url) => setForm({ ...form, poster_url: url })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <h3 className="font-semibold">When</h3>

          <div className="flex items-center gap-2">
            <Checkbox
              id="all_day"
              checked={form.all_day}
              onCheckedChange={(v) => setForm({ ...form, all_day: !!v })}
            />
            <Label htmlFor="all_day">All day event</Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.start_time.split('T')[0] : form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End (optional)</Label>
              <Input
                type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.end_time.split('T')[0] : form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <h3 className="font-semibold">Where</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Location name</Label>
              <Input
                value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                placeholder="Main Sanctuary"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Church St, Nairobi"
              />
            </div>
          </div>

          <MapPicker
            lat={form.latitude}
            lng={form.longitude}
            onPick={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
          />

          {form.latitude && form.longitude && (
            <p className="text-xs text-muted-foreground">
              Pin: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <h3 className="font-semibold">Visibility & capacity</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v ?? '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setForm({ ...form, visibility: v ?? '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (anyone can see)</SelectItem>
                  <SelectItem value="members_only">Members only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity (optional)</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_registration_required}
              onCheckedChange={(v) =>
                setForm({ ...form, is_registration_required: v })
              }
            />
            <Label>Require registration / ticketing</Label>
          </div>

          {form.is_registration_required && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Registration deadline</Label>
                <Input
                  type="datetime-local"
                  value={form.registration_deadline}
                  onChange={(e) =>
                    setForm({ ...form, registration_deadline: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm({ ...form, currency: v ?? '' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KES">KES</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : existing ? 'Save changes' : 'Create event'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

