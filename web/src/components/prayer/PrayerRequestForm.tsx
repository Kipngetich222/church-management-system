'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CheckCircle2 } from 'lucide-react'

export function PrayerRequestForm({
  churchId,
  membershipId,
  defaultType = 'prayer',
}: {
  churchId: string
  membershipId: string
  defaultType?: 'prayer' | 'counseling'
}) {
  const [form, setForm] = useState({
    type: defaultType,
    category: 'general',
    title: '',
    body: '',
    visibility: 'pastors_only',
  })
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('prayer_requests').insert({
      church_id: churchId,
      membership_id: membershipId,
      type: form.type,
      category: form.category,
      title: form.title,
      body: form.body,
      visibility: form.visibility as
        | 'private'
        | 'pastors_only'
        | 'public_anonymous'
        | 'public_named',
    })
    if (err) {
      setError(err.message)
      setState('idle')
      return
    }
    setState('done')
  }

  if (state === 'done') {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <div className="font-medium">
            {form.type === 'prayer' ? 'Prayer request received' : 'Counseling request received'}
          </div>
          <p className="text-sm text-muted-foreground">
            A pastor will follow up with you.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {form.type === 'prayer' ? 'Prayer request' : 'Counseling request'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prayer">Prayer</SelectItem>
                <SelectItem value="counseling">Counseling</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v ?? '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="health">Health</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="finances">Finances</SelectItem>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="spiritual">Spiritual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v ?? '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pastors_only">Pastors only</SelectItem>
                <SelectItem value="public_anonymous">Prayer wall (anonymous)</SelectItem>
                <SelectItem value="public_named">Prayer wall (with my name)</SelectItem>
                <SelectItem value="private">Just between me and God</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={state === 'saving'}>
            {state === 'saving' ? 'Submitting...' : 'Submit request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

