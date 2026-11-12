'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { GivingDownloadButton } from './GivingDownloadButton'
import {
  GIVING_TYPES,
  MAX_GIVING_AMOUNT,
  givingLabel,
  givingPhone,
  type GivingType,
  type PublicGivingPayment,
  type PublicGivingSettings,
} from '@/lib/giving'

export function GivingForm({
  churchId,
  churchName,
  settings,
  initialPayment,
}: {
  churchId: string
  churchName: string
  settings: PublicGivingSettings | null
  initialPayment: PublicGivingPayment | null
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    amount: '',
    phone: '',
    type: 'general' as GivingType,
  })
  const [payment, setPayment] = useState(initialPayment)
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState('')
  const requestId = useRef<string | null>(null),
    submitting = useRef(false),
    verifying = useRef(false)
  const pollingStarted = useRef(0)
  const pending =
    !!payment && ['initiating', 'pending', 'review'].includes(payment.status)
  const paymentId = payment?.id
  const changed = useCallback(() => {
    window.dispatchEvent(new Event('giving-updated'))
    router.refresh()
  }, [router])
  const verify = useCallback(async () => {
    if (!paymentId || verifying.current) return
    verifying.current = true
    setChecking(true)
    try {
      const response = await fetch(
        `/api/giving/payments/${paymentId}/verify?churchId=${churchId}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(55_000),
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          result.error || 'Payment confirmation is still pending.'
        )
      setPayment(result)
      setError('')
      if (result.status === 'succeeded' || result.status === 'failed') {
        requestId.current = null
        changed()
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Check payment status again shortly.'
      )
    } finally {
      verifying.current = false
      setChecking(false)
    }
  }, [churchId, paymentId, changed])
  useEffect(() => {
    if (!pending) return
    if (!pollingStarted.current) pollingStarted.current = Date.now()
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - pollingStarted.current < 120_000
      )
        void verify()
    }, 10_000)
    return () => clearInterval(timer)
  }, [pending, verify])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current || pending || !settings?.ready) return
    const phone = givingPhone(form.phone),
      amount = Number(form.amount)
    if (
      !phone ||
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > MAX_GIVING_AMOUNT
    ) {
      setError(
        'Enter a whole-shilling amount from KES 1 to 250,000 and a Kenyan M-Pesa phone number.'
      )
      return
    }
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      requestId.current ??= crypto.randomUUID()
      const response = await fetch('/api/giving/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(55_000),
        body: JSON.stringify({
          churchId,
          requestId: requestId.current,
          amount,
          phone,
          type: form.type,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          result.error || 'Could not request payment. Please try again.'
        )
      setPayment(result)
      pollingStarted.current = Date.now()
      if (result.status === 'succeeded' || result.status === 'failed')
        requestId.current = null
      changed()
    } catch (error) {
      setError(
        error instanceof Error && error.name !== 'TimeoutError'
          ? error.message
          : 'The connection was interrupted. Retry to recover this payment request, or check your giving history.'
      )
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  function reset() {
    requestId.current = null
    setPayment(null)
    setError('')
    setForm((current) => ({ ...current, amount: '' }))
  }
  if (payment)
    return (
      <Card>
        <CardContent className="space-y-4 pt-6" aria-live="polite">
          {payment.status === 'succeeded' ? (
            <CheckCircle2 className="h-10 w-10 text-primary" />
          ) : payment.status === 'failed' ? (
            <XCircle className="h-10 w-10 text-destructive" />
          ) : (
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          )}
          <div>
            <h2 className="font-semibold">
              {payment.status === 'succeeded'
                ? payment.environment === 'sandbox'
                  ? 'Test payment confirmed'
                  : 'Thank you for your giving'
                : payment.status === 'failed'
                  ? 'Payment was not completed'
                  : payment.status === 'review'
                    ? 'Confirmation pending'
                    : 'Check your phone'}
            </h2>
            <p className="text-sm text-muted-foreground">
              KES {Number(payment.amount).toLocaleString()} ·{' '}
              {givingLabel(payment.type)}
            </p>
          </div>
          {pending && (
            <p className="text-sm">
              Enter your M-Pesa PIN on the prompt sent to {payment.phone}. Your
              receipt will be available after payment is confirmed.
            </p>
          )}
          {payment.error && <p className="text-sm">{payment.error}</p>}
          {payment.environment === 'sandbox' && (
            <p className="text-sm text-muted-foreground">
              This is a sandbox test. No money is recorded as church income.
            </p>
          )}
          {payment.status === 'succeeded' && payment.offering_id && (
            <GivingDownloadButton
              url={`/api/giving/receipts/${payment.offering_id}?churchId=${churchId}`}
              label="Download receipt"
            />
          )}
          {pending ? (
            <Button
              type="button"
              variant="outline"
              onClick={verify}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check payment status'}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={reset}>
              {payment.status === 'failed' ? 'Try again' : 'Give again'}
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Give to {churchName}</CardTitle>
      </CardHeader>
      <CardContent>
        {!settings?.ready ? (
          <p className="text-sm text-muted-foreground">
            STK giving has not been enabled for this church yet. Please contact
            your church administrator.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {settings.environment === 'sandbox' && (
              <p className="rounded-md border p-3 text-sm">
                Test mode: these payments do not transfer real money.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="giving-amount">Amount (KES)</Label>
              <Input
                id="giving-amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_GIVING_AMOUNT}
                step={1}
                required
                value={form.amount}
                disabled={busy}
                placeholder="1,000"
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giving-phone">M-Pesa phone number</Label>
              <PhoneInput
                id="giving-phone"
                country="KE"
                required
                value={form.phone}
                disabled={busy}
                onChange={(phone) => setForm({ ...form, phone })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giving-type">Giving type</Label>
              <select
                id="giving-type"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.type}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as GivingType })
                }
              >
                {GIVING_TYPES.filter((type) => type !== 'pledge').map(
                  (type) => (
                    <option key={type} value={type}>
                      {givingLabel(type)}
                    </option>
                  )
                )}
              </select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Give via M-Pesa'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
