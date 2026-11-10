'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SmsPurchase } from '@/lib/services/sms-purchases.service'

export function SmsPurchaseForm({
  churchId,
  enabled,
  unitPrice,
  initial,
}: {
  churchId: string
  enabled: boolean
  unitPrice: number | null
  initial: SmsPurchase | null
}) {
  const router = useRouter()
  const [credits, setCredits] = useState(500),
    [phone, setPhone] = useState(''),
    [purchase, setPurchase] = useState(initial)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const requestId = useRef<string | null>(null)
  const checking = useRef(false)
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
    if (purchase?.status !== 'pending') return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void verify()
    }, 10000)
    return () => clearInterval(timer)
  }, [purchase?.status, verify])
  async function buy() {
    if (busy || pending) return
    setBusy(true)
    setError('')
    requestId.current ??= crypto.randomUUID()
    try {
      const response = await fetch('/api/sms/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId,
          credits,
          phone,
          requestId: requestId.current,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not start purchase')
      setPurchase(result)
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
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your SMS bundle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!enabled && (
          <p role="status" className="rounded-lg bg-muted p-4 text-sm">
            SMS purchasing is awaiting platform setup. Your platform
            administrator needs to enable M-Pesa payments and the SMS service.
            No payment will be taken until setup is complete.
          </p>
        )}
        <fieldset disabled={!enabled || busy || Boolean(pending)}>
          <legend className="mb-3 text-sm font-medium">SMS credits</legend>
          <div className="grid gap-3 sm:grid-cols-4">
            {[100, 500, 1000, 5000].map((amount) => (
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
                <span className="font-semibold">{amount.toLocaleString()}</span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  {unitPrice
                    ? `KES ${Math.ceil(amount * unitPrice).toLocaleString()}`
                    : 'Price not configured'}
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
            disabled={busy || Boolean(pending)}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A payment prompt will appear on this phone. Enter your PIN on your
            phone only.
          </p>
        </div>
        {purchase && (
          <div role="status" className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-semibold">
              {purchase.status === 'paid'
                ? `${purchase.credits.toLocaleString()} SMS credits added to your church`
                : purchase.status === 'pending'
                  ? 'Approve the M-Pesa prompt on your phone'
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
            {pending && purchase.checkout_id && (
              <Button className="mt-3" variant="outline" onClick={verify}>
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
          onClick={buy}
          disabled={!enabled || busy || Boolean(pending) || !phone.trim()}
        >
          {busy
            ? 'Requesting payment…'
            : `Buy ${credits.toLocaleString()} SMS credits${unitPrice ? ` · KES ${Math.ceil(credits * unitPrice).toLocaleString()}` : ''}`}
        </Button>
      </CardContent>
    </Card>
  )
}
