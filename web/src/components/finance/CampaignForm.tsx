'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function CampaignForm({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    description: '',
    goal_amount: '',
    currency: 'KES',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: err } = await supabase.from('campaigns').insert({
      church_id: churchId,
      name: form.name,
      description: form.description || null,
      goal_amount: parseFloat(form.goal_amount),
      currency: form.currency,
      start_date: form.start_date,
      end_date: form.end_date || null,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/admin/finance/campaigns')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Campaign name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. New Sanctuary Building Fund"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Goal amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.goal_amount}
                onChange={(e) => setForm({ ...form, goal_amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>End date (optional)</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create campaign'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}