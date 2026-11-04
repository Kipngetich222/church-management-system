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
import { PhoneInput } from '@/components/shared/PhoneInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { Calendar, Save, Plus, MessageSquare } from 'lucide-react'
import { visitorContactSchema, type VisitorComment } from '@/lib/visitors'
import type { Database } from '@/types/database'

type Visitor = Database['public']['Tables']['visitors']['Row']

type Followup = {
  id: string
  method: string | null
  notes: string
  created_at: string | null
  author_membership_id: string | null
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
  comments,
}: {
  churchId: string
  visitor: Visitor
  followups: Followup[]
  comments: VisitorComment[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: visitor.full_name,
    phone: visitor.phone ?? '',
    email: visitor.email ?? '',
    status: visitor.status ?? 'new',
    notes: visitor.notes ?? '',
  })
  const [followup, setFollowup] = useState({ method: 'call', notes: '' })
  const [saving, setSaving] = useState(false)
  const [addingFollowup, setAddingFollowup] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function saveVisitor() {
    if (saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const parsed = visitorContactSchema.safeParse(form)
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? 'Please check the visitor details.'
        )
      if (form.notes.trim().length > 5000)
        throw new Error('Notes can contain up to 5000 characters.')
      const input = parsed.data
      const { data, error: err } = await createClient()
        .from('visitors')
        .update({
          full_name: input.full_name,
          phone: input.phone || null,
          email: input.email || null,
          status: form.status,
          notes: form.notes.trim() || null,
        })
        .eq('id', visitor.id)
        .eq('church_id', churchId)
        .select('id')
        .maybeSingle()
      if (err) throw new Error(err.message)
      if (!data)
        throw new Error(
          'This visitor is no longer available or your access has changed.'
        )
      setNotice('Visitor details saved.')
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save the visitor.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function addFollowup() {
    if (addingFollowup || !followup.notes.trim()) return
    setAddingFollowup(true)
    setError('')
    setNotice('')
    try {
      if (followup.notes.trim().length > 5000)
        throw new Error('Notes can contain up to 5000 characters.')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in again.')
      const { data: author, error: authorError } = await supabase
        .from('church_memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('church_id', churchId)
        .eq('role', 'super_admin')
        .or('status.eq.active,status.is.null')
        .single()
      if (authorError)
        throw new Error('Could not verify your access. Please try again.')
      if (!author)
        throw new Error(
          'Your super admin access has changed. Please reload the page.'
        )

      const { error: err } = await supabase.from('visitor_followups').insert({
        visitor_id: visitor.id,
        author_membership_id: author.id,
        method: followup.method,
        notes: followup.notes.trim(),
      })

      if (err) {
        setError(err.message)
      } else {
        setFollowup({ method: 'call', notes: '' })
        setNotice('Follow-up saved.')
        router.refresh()
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save the follow-up.'
      )
    } finally {
      setAddingFollowup(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{visitor.full_name}</h1>
        <Badge
          variant={
            visitor.status === 'converted'
              ? 'default'
              : visitor.status === 'cold'
                ? 'outline'
                : 'secondary'
          }
        >
          {(visitor.status ?? 'new').replace('_', ' ')}
        </Badge>
      </div>
      <Badge variant="outline">
        {visitor.source === 'qr'
          ? 'Registered through the visitor QR code'
          : 'Added manually'}
      </Badge>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}

      {/* Contact info + status */}
      <Card>
        <CardHeader>
          <CardTitle>Visitor details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                aria-label="Full name"
                maxLength={160}
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v ?? '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneInput
                value={form.phone}
                onChange={(phone) => setForm({ ...form, phone })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                aria-label="Email"
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitor-internal-notes">Internal notes</Label>
            <Textarea
              id="visitor-internal-notes"
              maxLength={5000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          {visitor.first_visit_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              First visit:{' '}
              {format(new Date(visitor.first_visit_date), 'MMM d, yyyy')}
            </div>
          )}

          <Button onClick={saveVisitor} disabled={saving}>
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Save changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Visitor comments (
            {comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-4">
              <p className="whitespace-pre-wrap break-words text-sm">
                {comment.body}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {format(new Date(comment.created_at), 'MMM d, yyyy, h:mm a')}
              </p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This visitor has not left any comments yet.
            </p>
          )}
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
              <Select
                value={followup.method}
                onValueChange={(v) =>
                  setFollowup({ ...followup, method: v ?? '' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={followup.notes}
                onChange={(e) =>
                  setFollowup({ ...followup, notes: e.target.value })
                }
                rows={2}
                maxLength={5000}
                placeholder="What was discussed?"
              />
            </div>
          </div>
          <Button
            onClick={addFollowup}
            disabled={addingFollowup || !followup.notes.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            {addingFollowup ? 'Adding...' : 'Log follow-up'}
          </Button>

          <div className="divide-y pt-2">
            {followups.map((f) => (
              <div key={f.id} className="py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Badge variant="outline">{f.method ?? 'note'}</Badge>
                  <span>
                    {f.church_memberships?.users?.full_name ?? 'Staff'}
                  </span>
                  <span>·</span>
                  {f.created_at && (
                    <span>
                      {format(new Date(f.created_at), 'MMM d, h:mm a')}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {f.notes}
                </p>
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
