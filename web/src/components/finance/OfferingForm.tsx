'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const TYPES = [
  ['tithe', 'Tithe'],
  ['general', 'General Offering'],
  ['missions', 'Missions'],
  ['building_fund', 'Building Fund'],
  ['welfare', 'Welfare'],
  ['thanksgiving', 'Thanksgiving'],
  ['pledge', 'Pledge Payment'],
  ['other', 'Other'],
]

const METHODS = [
  ['cash', 'Cash'],
  ['mpesa', 'M-Pesa'],
  ['bank_transfer', 'Bank Transfer'],
  ['cheque', 'Cheque'],
  ['card', 'Card'],
  ['online', 'Online'],
  ['other', 'Other'],
]

export function OfferingForm({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [members, setMembers] = useState<{ id: string; label: string }[]>([])
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    membership_id: '',
    amount: '',
    type: 'general',
    method: 'cash',
    campaign_id: '',
    reference: '',
    notes: '',
    given_at: new Date().toISOString().slice(0, 16),
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('church_memberships')
      .select('id, users(full_name, email)')
      .eq('church_id', churchId)
      .then(({ data }) => {
        setMembers(
          (data ?? []).map((m: any) => ({
            id: m.id,
            label: m.users?.full_name ?? m.users?.email ?? 'Unknown',
          }))
        )
      })
    supabase
      .from('campaigns')
      .select('id, name')
      .eq('church_id', churchId)
      .eq('status', 'active')
      .then(({ data }) => setCampaigns(data ?? []))
  }, [churchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: err } = await supabase.from('offerings').insert({
      church_id: churchId,
      membership_id: form.membership_id || null,
      amount: parseFloat(form.amount),
      type: form.type as 'tithe' | 'general' | 'missions' | 'building_fund' | 'welfare' | 'thanksgiving' | 'pledge' | 'other',
      method: form.method as 'cash' | 'mpesa' | 'bank_transfer' | 'cheque' | 'card' | 'online' | 'other',
      campaign_id: form.campaign_id || null,
      reference: form.reference || null,
      notes: form.notes || null,
      given_at: new Date(form.given_at).toISOString(),
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/admin/finance/offerings')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v ?? '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Member (optional)</Label>
              <Select
                value={form.membership_id}
                onValueChange={(v) => setForm({ ...form, membership_id: v ?? '' })}
              >
                <SelectTrigger><SelectValue placeholder="Anonymous" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {campaigns.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <Label>Campaign (optional)</Label>
                <Select
                  value={form.campaign_id}
                  onValueChange={(v) => setForm({ ...form, campaign_id: v ?? '' })}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={form.given_at}
                onChange={(e) => setForm({ ...form, given_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="M-Pesa code, cheque #, etc."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Record offering'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

