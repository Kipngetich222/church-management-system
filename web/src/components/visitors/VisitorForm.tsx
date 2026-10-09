'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function VisitorForm({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    first_visit_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data, error: err } = await supabase
      .from('visitors')
      .insert({
        church_id: churchId,
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        first_visit_date: form.first_visit_date || null,
        notes: form.notes || null,
        status: 'new',
      })
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push(`/admin/visitors/${data!.id}`)
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>First visit date</Label>
            <Input
              type="date"
              value={form.first_visit_date}
              onChange={(e) => setForm({ ...form, first_visit_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Add visitor'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}