'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SmsPurchase } from '@/lib/services/sms-purchases.service'
import { smsPaymentPhone, type SmsBundle } from '@/lib/sms-purchase'

export function SmsPurchaseForm({
  churchId,
  enabled,
  bundles,
  issues,
  environment,
  initial,
}: {
  churchId: string
  enabled: boolean
  bundles: SmsBundle[]
  issues: string[]
  environment: 'sandbox' | 'production'
  initial: SmsPurchase | null
}) {
  const router = useRouter()
  const [credits, setCredits] = useState(initial?.credits ?? 500),
    [phone, setPhone] = useState(initial?.phone ?? ''),
    [purchase, setPurchase] = useState(initial)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const requestId = useRef<string | null>(null)
  const checking = useRef(false)
  const submitting = useRef(false)
  const selectedBundle = bundles.find((bundle) => bundle.credits === credits)
  const pending =
    purchase && ['initiating', 'pending', 'review'].includes(purchase.status)
  const verify = useCallback(async () => {
    if (!purchase || checking.current) return
    checking.current = true
    try {
      const response = await fetch(`/api/sms/purchases/${purchase.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId }),
        signal: AbortSignal.timeout(60000),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Payment confirmation is still pending')
      setPurchase(result)
      setError('')
      if (result.status === 'paid' || result.status === 'failed') {
        requestId.current = null
        window.dispatchEvent(new Event('sms-balance-changed'))
        router.refresh()
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Please check payment again shortly'
      )
    } finally {
      checking.current = false
    }
  }, [purchase, churchId, router])
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void verify()
    }, 10000)
    return () => clearInterval(timer)
  }, [pending, verify])
  async function buy() {
    if (!enabled || !selectedBundle || submitting.current || pending) return
    const payer = smsPaymentPhone(phone)
    if (!payer) {
      setError(
        'Enter a valid Kenyan M-Pesa number, for example 0712 345 678 or +254712345678.'
      )
      return
    }
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      requestId.current ??= crypto.randomUUID()
      const response = await fetch('/api/sms/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          credits,
          phone: payer,
          quotedAmountKes: selectedBundle.amountKes,
          requestId: requestId.current,
        }),
        signal: AbortSignal.timeout(60000),
      })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 409) router.refresh()
        throw new Error(result.error || 'Could not start purchase')
      }
      setPurchase(result)
      setCredits(result.credits)
      setPhone(result.phone)
      if (result.status === 'failed' || result.status === 'paid') {
        requestId.current = null
        window.dispatchEvent(new Event('sms-balance-changed'))
      }
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not start purchase. Check the purchase history before trying again.'
      )
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your SMS bundle</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            void buy()
          }}
        >
          {!enabled && (
            <div role="status" className="rounded-lg bg-muted p-4 text-sm">
              <p>
                SMS purchasing is awaiting platform setup. Ask your platform
                administrator to complete the following:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <fieldset disabled={!enabled || busy || Boolean(pending)}>
            <legend className="mb-3 text-sm font-medium">SMS credits</legend>
            <div className="grid gap-3 sm:grid-cols-4">
              {bundles.map(({ credits: amount, amountKes }) => (
                <label
                  key={amount}
                  className={`cursor-pointer rounded-lg border p-4 ${credits === amount ? 'border-primary bg-primary/5' : ''}`}
                >
                  <input
                    type="radio"
                    name="sms-bundle"
                    value={amount}
                    checked={credits === amount}
                    onChange={() => setCredits(amount)}
                    className="mr-2"
                  />
                  <span className="font-semibold">
                    {amount.toLocaleString()}
                  </span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    KES {amountKes.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="sms-payment-phone">M-Pesa phone number</Label>
            <Input
              id="sms-payment-phone"
              type="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phone}
              disabled={!enabled || busy || Boolean(pending)}
              required
              maxLength={30}
              aria-describedby="sms-phone-help"
              onChange={(e) => setPhone(e.target.value)}
            />
            <p id="sms-phone-help" className="text-xs text-muted-foreground">
              {environment === 'sandbox'
                ? 'Test mode uses the Daraja simulator. A real phone prompt requires live mode.'
                : 'M-Pesa will request payment on this phone. Enter your PIN on your phone only.'}
            </p>
          </div>
          {purchase && (
            <div role="status" className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold">
                {purchase.status === 'paid'
                  ? `${purchase.credits.toLocaleString()} SMS credits added to your church`
                  : purchase.status === 'pending'
                    ? environment === 'sandbox'
                      ? 'Test payment requested — complete it in the Daraja simulator'
                      : `Approve the M-Pesa prompt on +${purchase.phone}`
                    : purchase.status === 'failed'
                      ? 'Payment was not completed'
                      : 'Payment needs confirmation'}
              </p>
              <p className="mt-1">
                KES {purchase.amount_kes.toLocaleString()} ·{' '}
                {purchase.credits.toLocaleString()} SMS credits ·{' '}
                {purchase.status}
              </p>
              {purchase.error && <p className="mt-2">{purchase.error}</p>}
              {pending && (
                <Button
                  type="button"
                  className="mt-3"
                  variant="outline"
                  onClick={verify}
                >
                  Check payment status
                </Button>
              )}
              {purchase.receipt && (
                <p className="mt-1">Receipt: {purchase.receipt}</p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              !enabled ||
              !selectedBundle ||
              busy ||
              Boolean(pending) ||
              !phone.trim()
            }
          >
            {busy
              ? 'Requesting payment…'
              : `Buy ${credits.toLocaleString()} SMS credits${selectedBundle ? ` · KES ${selectedBundle.amountKes.toLocaleString()}` : ''}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
