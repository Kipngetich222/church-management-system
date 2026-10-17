'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { CheckCircle2, Loader2, Copy } from 'lucide-react'
import type { PaymentMethod } from '@/lib/services/events.service'

const METHOD_LABEL: Record<string, string> = {
  till: 'M-Pesa Till number',
  paybill: 'M-Pesa Paybill',
  phone: 'Phone number',
}

export function RegisterForEvent({
  eventId,
  price,
  currency,
  deadline,
  capacity,
  paymentMethod,
  paymentNumber,
  paymentAccount,
  paymentInstructions,
}: {
  eventId: string
  price: number
  currency: string
  deadline: string | null
  capacity: number | null
  paymentMethod?: PaymentMethod | null
  paymentNumber?: string | null
  paymentAccount?: string | null
  paymentInstructions?: string | null
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')

  const closed = deadline ? new Date(deadline) < new Date() : false
  const isPaid = price > 0
  const hasPaymentDetails = isPaid && !!paymentNumber

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
          Registration closed on{' '}
          {new Date(deadline!).toLocaleDateString(undefined, {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
          .
        </CardContent>
      </Card>
    )
  }

  if (state === 'done') {
    return (
      <Card className="border-primary/40">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <div className="font-medium">You&apos;re registered!</div>
          <p className="text-xs text-muted-foreground">Ticket code</p>
          <code className="text-sm bg-muted px-3 py-1 rounded">{ticket}</code>
          {isPaid && hasPaymentDetails && (
            <p className="text-xs text-muted-foreground">
              Complete your payment using the details below and use your ticket
              code as the reference.
            </p>
          )}
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
      <CardContent className="space-y-4">
        {isPaid && hasPaymentDetails && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="font-medium">{METHOD_LABEL[paymentMethod ?? ''] ?? 'Payment'}</div>
            <div className="flex items-center gap-2">
              <code className="text-base font-semibold">{paymentNumber}</code>
              {paymentAccount && (
                <span className="text-muted-foreground">· Acc {paymentAccount}</span>
              )}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => navigator.clipboard.writeText(paymentNumber ?? '')}
                aria-label="Copy payment number"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            {paymentInstructions && (
              <p className="text-xs text-muted-foreground">{paymentInstructions}</p>
            )}
          </div>
        )}

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
            <PhoneInput
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={state === 'loading'}>
            {state === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Registering...
              </>
            ) : isPaid ? (
              `Register · ${currency} ${price}`
            ) : (
              'Register'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
