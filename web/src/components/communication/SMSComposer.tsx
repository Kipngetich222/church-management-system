'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Send, Users } from 'lucide-react'

export function SMSComposer({
  churchId,
  role,
  deptIds,
}: {
  churchId: string
  role: string
  deptIds: string[]
}) {
  const router = useRouter()
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    body: '',
    filterType: role === 'dept_admin' ? 'department' : 'all',
    departmentIds: [] as string[],
    scheduledAt: '',
  })
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('departments')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name')
      .then(({ data }) => {
        const allowed =
          role === 'dept_admin'
            ? (data ?? []).filter((d) => deptIds.includes(d.id))
            : data ?? []
        setDepartments(allowed)
      })
  }, [churchId, role, deptIds])

  async function previewCount() {
    const supabase = createClient()
    if (form.filterType === 'all') {
      const { count } = await supabase
        .from('church_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('church_id', churchId)
      setRecipientCount(count ?? 0)
    } else if (form.filterType === 'department' && form.departmentIds.length) {
      const { count } = await supabase
        .from('department_members')
        .select('*', { count: 'exact', head: true })
        .in('department_id', form.departmentIds)
      setRecipientCount(count ?? 0)
    }
  }

  async function send() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        churchId,
        channel: 'sms',
        body: form.body,
        recipientFilter:
          form.filterType === 'department'
            ? { type: 'department', ids: form.departmentIds }
            : { type: form.filterType as any, ids: [] },
        scheduledAt: form.scheduledAt || undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to send')
      setLoading(false)
      return
    }

    router.push('/admin/communication/history')
    router.refresh()
  }

  const charCount = form.body.length
  const smsCount = Math.ceil(charCount / 160) || 1

  return (
    <Card>
      <CardContent className="pt-6 space-y-4 max-w-2xl">
        <div className="space-y-2">
          <Label>Recipients</Label>
          <Select value={form.filterType} onValueChange={(v) => setForm({ ...form, filterType: v ?? '' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {role === 'super_admin' && <SelectItem value="all">All members</SelectItem>}
              <SelectItem value="department">By department</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.filterType === 'department' && (
          <div className="space-y-2">
            <Label>Select departments</Label>
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      departmentIds: f.departmentIds.includes(d.id)
                        ? f.departmentIds.filter((id) => id !== d.id)
                        : [...f.departmentIds, d.id],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    form.departmentIds.includes(d.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={5}
            placeholder="Type your message..."
            maxLength={480}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{charCount} chars · {smsCount} SMS part{smsCount > 1 ? 's' : ''}</span>
            {recipientCount != null && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> ~{recipientCount} recipients
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Schedule (optional)</Label>
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to send now.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={send} disabled={loading || !form.body}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> {form.scheduledAt ? 'Schedule' : 'Send now'}</>
            )}
          </Button>
          <Button variant="outline" onClick={previewCount} type="button">
            Preview count
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
