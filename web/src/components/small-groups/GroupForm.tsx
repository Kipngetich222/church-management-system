'use client'

import { useState } from 'react'
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
import { DAYS_OF_WEEK } from '@/lib/constants/days'

type LeaderOption = {
  id: string
  users: { full_name: string | null; email: string } | null
}

type Existing = {
  id: string
  name: string
  description: string | null
  meeting_day: string | null
  meeting_time: string | null
  location: string | null
  leader_membership_id: string | null
}

export function GroupForm({
  churchId,
  leaders,
  existing,
}: {
  churchId: string
  leaders: LeaderOption[]
  existing?: Existing
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    meeting_day: existing?.meeting_day ?? '',
    meeting_time: existing?.meeting_time ?? '',
    location: existing?.location ?? '',
    leader_membership_id: existing?.leader_membership_id ?? '',
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
      name: form.name,
      description: form.description || null,
      meeting_day: form.meeting_day || null,
      meeting_time: form.meeting_time || null,
      location: form.location || null,
      leader_membership_id: form.leader_membership_id || null,
    }

    const { error: err } = existing
      ? await supabase
          .from('small_groups')
          .update(payload)
          .eq('id', existing.id)
      : await supabase.from('small_groups').insert(payload)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/admin/small-groups')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Group name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Tuesday Night Fellowship"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              placeholder="What is this group about?"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Meeting day</Label>
              <Select
                value={form.meeting_day}
                onValueChange={(v) =>
                  setForm({ ...form, meeting_day: v ?? '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Meeting time</Label>
              <Input
                type="time"
                value={form.meeting_time}
                onChange={(e) =>
                  setForm({ ...form, meeting_time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Room 3, or 123 Main St"
            />
          </div>

          <div className="space-y-2">
            <Label>Group leader</Label>
            <Select
              value={form.leader_membership_id}
              onValueChange={(v) =>
                setForm({ ...form, leader_membership_id: v ?? '' })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a leader (optional)" />
              </SelectTrigger>
              <SelectContent>
                {leaders.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.users?.full_name ?? l.users?.email ?? 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leaders are members of the church. They don&apos;t need to be
              group members.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Saving...'
                : existing
                  ? 'Save changes'
                  : 'Create group'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
