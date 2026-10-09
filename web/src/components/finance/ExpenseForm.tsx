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

export function ExpenseForm({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    method: 'cash',
    reference: '',
    spent_at: new Date().toISOString().slice(0, 16),
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('expense_categories')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [churchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: err } = await supabase.from('expenses').insert({
      church_id: churchId,
      category_id: form.category_id || null,
      amount: parseFloat(form.amount),
      description: form.description,
      method: form.method as 'cash' | 'mpesa' | 'bank_transfer' | 'cheque' | 'card' | 'online' | 'other',
      reference: form.reference || null,
      spent_at: new Date(form.spent_at).toISOString(),
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push('/admin/finance/expenses')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Electricity bill — October"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v ?? '' })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v ?? '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date & time</Label>
              <Input
                type="datetime-local"
                value={form.spent_at}
                onChange={(e) => setForm({ ...form, spent_at: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Reference</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Record expense'}
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

