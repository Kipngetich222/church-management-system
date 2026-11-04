'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { manualVisitorSchema } from '@/lib/visitors'
import { todayKey } from '@/lib/utils/recurrence'

export function VisitorForm({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    first_visit_date: todayKey(),
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const parsed = manualVisitorSchema.safeParse(form)
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? 'Please check the visitor details.'
        )
      const input = parsed.data
      const { data, error: err } = await createClient()
        .from('visitors')
        .insert({
          church_id: churchId,
          full_name: input.full_name,
          phone: input.phone || null,
          email: input.email || null,
          first_visit_date: input.first_visit_date || null,
          notes: input.notes || null,
          status: 'new',
          source: 'manual',
        })
        .select('id')
        .single()
      if (err) throw new Error(err.message)
      router.push(`/admin/visitors/${data.id}`)
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not add the visitor. Please try again.'
      )
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-visitor-name">Full name</Label>
            <Input
              id="manual-visitor-name"
              maxLength={160}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-visitor-phone">Phone</Label>
              <PhoneInput
                id="manual-visitor-phone"
                value={form.phone}
                onChange={(phone) => setForm({ ...form, phone })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-visitor-email">Email</Label>
              <Input
                id="manual-visitor-email"
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-visitor-date">First visit date</Label>
            <Input
              id="manual-visitor-date"
              type="date"
              value={form.first_visit_date}
              onChange={(e) =>
                setForm({ ...form, first_visit_date: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-visitor-notes">Internal notes</Label>
            <Textarea
              id="manual-visitor-notes"
              maxLength={5000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Add visitor'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
