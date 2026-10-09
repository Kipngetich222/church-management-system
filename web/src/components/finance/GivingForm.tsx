'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2 } from 'lucide-react'

export function GivingForm({
  churchId,
  churchName,
}: {
  churchId: string
  churchName: string
}) {
  const [form, setForm] = useState({
    amount: '',
    phone: '',
    type: 'tithe',
  })
  const [state, setState] = useState<'idle' | 'loading' | 'pending' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setError('')

    const res = await fetch('/api/giving/mpesa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        churchId,
        amount: parseFloat(form.amount),
        phone: form.phone,
        type: form.type,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setState('error')
      setError(data.error || 'Something went wrong')
      return
    }

    setState('pending')
  }

  if (state === 'pending') {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <div className="font-medium">Check your phone</div>
          <p className="text-sm text-muted-foreground">
            Enter your M-Pesa PIN to complete the transaction.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Give to {churchName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="1000"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>M-Pesa phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="254712345678"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tithe">Tithe</SelectItem>
                <SelectItem value="general">Offering</SelectItem>
                <SelectItem value="missions">Missions</SelectItem>
                <SelectItem value="building_fund">Building Fund</SelectItem>
                <SelectItem value="thanksgiving">Thanksgiving</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={state === 'loading'}>
            {state === 'loading' ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
            ) : (
              'Give via M-Pesa'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
