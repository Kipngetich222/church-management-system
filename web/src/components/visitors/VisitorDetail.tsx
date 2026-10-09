'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Phone, Mail, Calendar, Save, Plus } from 'lucide-react'

type Visitor = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  first_visit_date: string | null
  invited_by_membership_id: string | null
  notes: string | null
  status: string
  assigned_to: string | null
}

type Followup = {
  id: string
  method: string | null
  notes: string
  created_at: string
  author_membership_id: string
  church_memberships: { users: { full_name: string | null } | null } | null
}

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'In follow-up' },
  { value: 'converted', label: 'Converted' },
  { value: 'cold', label: 'Cold' },
]

const METHODS = [
  { value: 'call', label: 'Phone call' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'visit', label: 'Home visit' },
  { value: 'in_person', label: 'In person' },
]

export function VisitorDetail({
  churchId,
  visitor,
  followups,
}: {
  churchId: string
  visitor: Visitor
  followups: Followup[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: visitor.full_name,
    phone: visitor.phone ?? '',
    email: visitor.email ?? '',
    status: visitor.status,
    notes: visitor.notes ?? '',
  })
  const [followup, setFollowup] = useState({ method: 'call', notes: '' })
  const [saving, setSaving] = useState(false)
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [error, setError] = useState('')

  async function saveVisitor() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('visitors')
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', visitor.id)

    if (err) setError(err.message)
    setSaving(false)
    router.refresh()
  }

  async function addFollowup() {
    if (!followup.notes.trim()) return
    setAddingFollowup(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: author } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user!.id)
      .eq('church_id', churchId)
      .single()

    const { error: err } = await supabase.from('visitor_followups').insert({
      visitor_id: visitor.id,
      author_membership_id: author!.id,
      method: followup.method,
      notes: followup.notes,
    })

    if (err) {
      setError(err.message)
    } else {
      setFollowup({ method: 'call', notes: '' })
      router.refresh()
    }
    setAddingFollowup(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{visitor.full_name}</h1>
        <Badge variant={
          visitor.status === 'converted' ? 'default' :
          visitor.status === 'cold' ? 'outline' : 'secondary'
        }>
          {visitor.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Contact info + status */}
      <Card>
        <CardHeader>
          <CardTitle>Visitor details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v ?? '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          {visitor.first_visit_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              First visit: {format(new Date(visitor.first_visit_date), 'MMM d, yyyy')}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={saveVisitor} disabled={saving}>
            {saving ? 'Saving...' : (<><Save className="h-4 w-4 mr-2" /> Save changes</>)}
          </Button>
        </CardContent>
      </Card>

      {/* Follow-up log */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-up log ({followups.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={followup.method} onValueChange={(v) => setFollowup({ ...followup, method: v ?? '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={followup.notes}
                onChange={(e) => setFollowup({ ...followup, notes: e.target.value })}
                rows={2}
                placeholder="What was discussed?"
              />
            </div>
          </div>
          <Button onClick={addFollowup} disabled={addingFollowup || !followup.notes.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {addingFollowup ? 'Adding...' : 'Log follow-up'}
          </Button>

          <div className="divide-y pt-2">
            {followups.map((f) => (
              <div key={f.id} className="py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Badge variant="outline">{f.method ?? 'note'}</Badge>
                  <span>{f.church_memberships?.users?.full_name ?? 'Staff'}</span>
                  <span>·</span>
                  <span>{format(new Date(f.created_at), 'MMM d, h:mm a')}</span>
                </div>
                <p className="text-sm">{f.notes}</p>
              </div>
            ))}
            {followups.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No follow-ups logged yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

