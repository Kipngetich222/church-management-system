'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ResourceBookingForm({
  churchId,
  membershipId,
  resources,
}: {
  churchId: string
  membershipId: string
  resources: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    resource_id: '',
    title: '',
    purpose: '',
    starts_at: '',
    ends_at: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError('End time must be after start time')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: err } = await supabase.from('resource_bookings').insert({
      resource_id: form.resource_id,
      church_id: churchId,
      membership_id: membershipId,
      title: form.title,
      purpose: form.purpose || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      status: 'pending',
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setForm({ resource_id: '', title: '', purpose: '', starts_at: '', ends_at: '' })
    setLoading(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a booking</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Resource</Label>
            <Select value={form.resource_id} onValueChange={(v) => setForm({ ...form, resource_id: v ?? '' })} required>
              <SelectTrigger><SelectValue placeholder="Choose a resource" /></SelectTrigger>
              <SelectContent>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Purpose title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Youth Bible study"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ends</Label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional details</Label>
            <Textarea
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-primary">
              Booking submitted. You'll be notified once approved.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
