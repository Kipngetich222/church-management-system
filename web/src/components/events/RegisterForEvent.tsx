'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function RegisterForEvent({
  eventId,
  price,
  currency,
  deadline,
  capacity,
}: {
  eventId: string
  price: number
  currency: string
  deadline: string | null
  capacity: number | null
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')

  const closed = deadline ? new Date(deadline) < new Date() : false
  const isPaid = price > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setError('')

    const res = await fetch('/api/events/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, ...form }),
    })

    const data = await res.json()
    if (!res.ok) {
      setState('error')
      setError(data.error || 'Registration failed')
      return
    }

    if (isPaid && data.checkout_url) {
      window.location.href = data.checkout_url
      return
    }

    setTicket(data.ticket_code)
    setState('done')
  }

  if (closed) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Registration is closed for this event.
        </CardContent>
      </Card>
    )
  }

  if (state === 'done') {
    return (
      <Card className="border-primary/40">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <div className="font-medium">You're registered!</div>
          <p className="text-xs text-muted-foreground">Ticket code</p>
          <code className="text-sm bg-muted px-3 py-1 rounded">{ticket}</code>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Register {isPaid ? `· ${currency} ${price}` : '· Free'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Phone (optional)</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={state === 'loading'}>
            {state === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Registering...
              </>
            ) : isPaid ? (
              `Pay ${currency} ${price}`
            ) : (
              'Register'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}