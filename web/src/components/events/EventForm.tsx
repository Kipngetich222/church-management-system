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
import type { EventVisibility } from '@/lib/constants/events'
import { Link2, MapPin } from 'lucide-react'

type Option = { id: string; name: string }

type Existing = {
  id: string
  title: string
  slug: string
  description: string | null
  start_time: string
  end_time: string | null
  all_day: boolean
  event_type: string | null
  meeting_link: string | null
  meeting_platform: string | null
  location_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  poster_url: string | null
  capacity: number | null
  status: string
  visibility: string
  visibility_department_id: string | null
  visibility_group_id: string | null
  is_registration_required: boolean
  registration_deadline: string | null
  price: number | null
  currency: string
  payment_method: string | null
  payment_number: string | null
  payment_account: string | null
  payment_instructions: string | null
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
  departments = [],
  groups = [],
}: {
  churchId: string
  existing?: Existing
  departments?: Option[]
  groups?: Option[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    slug: existing?.slug ?? '',
    description: existing?.description ?? '',
    start_time: toLocalInput(existing?.start_time ?? null),
    end_time: toLocalInput(existing?.end_time ?? null),
    all_day: existing?.all_day ?? false,
    event_type: existing?.event_type ?? 'physical',
    meeting_link: existing?.meeting_link ?? '',
    meeting_platform: existing?.meeting_platform ?? '',
    location_name: existing?.location_name ?? '',
    address: existing?.address ?? '',
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
    poster_url: existing?.poster_url ?? '',
    capacity: existing?.capacity ? String(existing.capacity) : '',
    status: existing?.status ?? 'published',
    visibility: existing?.visibility ?? 'public',
    visibility_department_id: existing?.visibility_department_id ?? '',
    visibility_group_id: existing?.visibility_group_id ?? '',
    is_registration_required: existing?.is_registration_required ?? false,
    registration_deadline: toLocalInput(existing?.registration_deadline ?? null),
    price: existing?.price != null ? String(existing.price) : '0',
    currency: existing?.currency ?? 'KES',
    payment_method: existing?.payment_method ?? 'free',
    payment_number: existing?.payment_number ?? '',
    payment_account: existing?.payment_account ?? '',
    payment_instructions: existing?.payment_instructions ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isOnline = form.event_type === 'online'
  const isPaid = form.is_registration_required && parseFloat(form.price || '0') > 0
  const needsPaymentDetails =
    isPaid && ['till', 'paybill', 'phone'].includes(form.payment_method)
  const isMembersOnlyAudience = form.visibility !== 'public'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isOnline && !form.meeting_link.trim()) {
      setError('Please add the meeting link for this online event.')
      setLoading(false)
      return
    }
    if (form.visibility === 'department' && !form.visibility_department_id) {
      setError('Choose the department this event is for.')
      setLoading(false)
      return
    }
    if (form.visibility === 'group' && !form.visibility_group_id) {
      setError('Choose the group this event is for.')
      setLoading(false)
      return
    }
    if (needsPaymentDetails && !form.payment_number.trim()) {
      setError('Add the till / paybill / phone number for payments.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const payload = {
      church_id: churchId,
      title: form.title,
      slug: form.slug || slugify(form.title),
      description: form.description || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      all_day: form.all_day,
      event_type: form.event_type,
      meeting_link: isOnline ? form.meeting_link.trim() || null : null,
      meeting_platform: isOnline ? form.meeting_platform.trim() || null : null,
      location_name: form.location_name || null,
      address: form.address || null,
      latitude: form.latitude,
      longitude: form.longitude,
      poster_url: form.poster_url || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      status: form.status as 'draft' | 'published' | 'cancelled' | 'completed',
      visibility: form.visibility as EventVisibility,
      visibility_department_id:
        form.visibility === 'department' ? form.visibility_department_id : null,
      visibility_group_id:
        form.visibility === 'group' ? form.visibility_group_id : null,
      is_registration_required: form.is_registration_required,
      registration_deadline: form.registration_deadline
        ? new Date(form.registration_deadline).toISOString()
        : null,
      price: parseFloat(form.price) || 0,
      currency: form.currency,
      payment_method: isPaid ? form.payment_method : 'free',
      payment_number: needsPaymentDetails ? form.payment_number.trim() : null,
      payment_account: needsPaymentDetails ? form.payment_account.trim() || null : null,
      payment_instructions: needsPaymentDetails
        ? form.payment_instructions.trim() || null
        : null,
    }

    if (existing) {
      const { error: err } = await supabase
        .from('events')
        .update(payload)
        .eq('id', existing.id)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      router.push('/admin/events')
      router.refresh()
      return
    }

    const { data, error: err } = await supabase
      .from('events')
      .insert(payload)
      .select('id')
      .single()

    if (err || !data) {
      setError(err?.message ?? 'Could not create the event')
      setLoading(false)
      return
    }

    // Land on the new event with the QR prompt so the admin can decide whether
    // to generate a QR code right away.
    router.push(`/admin/events/${data.id}?created=1`)
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
          <p className="text-xs text-muted-foreground -mt-2">
            Optional. If you skip the poster, a placeholder icon is shown instead.
          </p>
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
          <h3 className="font-semibold">How members attend</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select
                value={form.event_type}
                onValueChange={(v) => setForm({ ...form, event_type: v ?? 'physical' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">Physical — at a venue</SelectItem>
                  <SelectItem value="online">Online — a meeting link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isOnline ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Meeting link
                </Label>
                <Input
                  type="url"
                  value={form.meeting_link}
                  onChange={(e) => setForm({ ...form, meeting_link: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  required={isOnline}
                />
                <p className="text-xs text-muted-foreground">
                  Members see this once the event is published so they can join.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Platform (optional)</Label>
                <Input
                  value={form.meeting_platform}
                  onChange={(e) => setForm({ ...form, meeting_platform: e.target.value })}
                  placeholder="Zoom, Google Meet, Teams…"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Location name
                  </Label>
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

              <div className="space-y-2">
                <Label>Coordinates & directions</Label>
                <p className="text-xs text-muted-foreground">
                  Pin the venue so members can open directions on their maps app.
                </p>
                <MapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  address={form.address}
                  onPick={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
                  onAddress={(address) => setForm({ ...form, address })}
                />
              </div>
            </>
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
                  <SelectItem value="draft">Draft — hidden from members</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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
            <div className="space-y-2 md:col-span-2">
              <Label>Who can see this event</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setForm({ ...form, visibility: v ?? 'public' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — anyone with the link</SelectItem>
                  <SelectItem value="all_members">All members of the church</SelectItem>
                  <SelectItem value="super_admins">Super admins only</SelectItem>
                  <SelectItem value="department">A specific department</SelectItem>
                  <SelectItem value="group">A specific group</SelectItem>
                  <SelectItem value="men">Men</SelectItem>
                  <SelectItem value="women">Women</SelectItem>
                  <SelectItem value="youth">Youth</SelectItem>
                </SelectContent>
              </Select>
              {isMembersOnlyAudience && (
                <p className="text-xs text-muted-foreground">
                  Members still see it in their dashboard. Anyone else can view it
                  via the shared link or QR code.
                </p>
              )}
            </div>
            {form.visibility === 'department' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Department</Label>
                <Select
                  value={form.visibility_department_id || ''}
                  onValueChange={(v) =>
                    setForm({ ...form, visibility_department_id: v ?? '' })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Choose a department" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.visibility === 'group' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Group</Label>
                <Select
                  value={form.visibility_group_id || ''}
                  onValueChange={(v) =>
                    setForm({ ...form, visibility_group_id: v ?? '' })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <p className="text-xs text-muted-foreground">
                  Registrations close automatically after this time.
                </p>
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

          {isPaid && (
            <div className="grid gap-4 md:grid-cols-2 border-t pt-4">
              <div className="space-y-2">
                <Label>How members pay</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v ?? 'free' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free — no payment</SelectItem>
                    <SelectItem value="till">M-Pesa Till number</SelectItem>
                    <SelectItem value="paybill">M-Pesa Paybill</SelectItem>
                    <SelectItem value="phone">Send to a phone number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {needsPaymentDetails && (
                <>
                  <div className="space-y-2">
                    <Label>
                      {form.payment_method === 'till'
                        ? 'Till number'
                        : form.payment_method === 'paybill'
                          ? 'Paybill number'
                          : 'Phone number'}
                    </Label>
                    <Input
                      value={form.payment_number}
                      onChange={(e) =>
                        setForm({ ...form, payment_number: e.target.value })
                      }
                      placeholder={form.payment_method === 'phone' ? '0712 345 678' : '123456'}
                    />
                  </div>
                  {form.payment_method === 'paybill' && (
                    <div className="space-y-2">
                      <Label>Account number</Label>
                      <Input
                        value={form.payment_account}
                        onChange={(e) =>
                          setForm({ ...form, payment_account: e.target.value })
                        }
                        placeholder="EVENT"
                      />
                    </div>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <Label>Payment instructions (optional)</Label>
                    <Textarea
                      value={form.payment_instructions}
                      onChange={(e) =>
                        setForm({ ...form, payment_instructions: e.target.value })
                      }
                      rows={2}
                      placeholder="Use your ticket code as the account reference."
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : existing ? 'Save changes' : 'Create event'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
