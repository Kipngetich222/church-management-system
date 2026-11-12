'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneInput } from '@/components/shared/PhoneInput'
import {
  DESTINATION_LABELS,
  DESTINATION_TYPES,
  type DestinationType,
  type GivingSettingsInput,
  type PublicGivingSettings,
} from '@/lib/giving'

export function GivingSettingsForm({
  churchId,
  initial,
}: {
  churchId: string
  initial: PublicGivingSettings | null
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [form, setForm] = useState<GivingSettingsInput>({
    enabled: initial?.enabled ?? false,
    destinationType: initial?.destination_type ?? 'paybill',
    destinationNumber: initial?.destination_number ?? '',
    accountReference: initial?.account_reference ?? '',
    businessShortCode: initial?.business_shortcode ?? '',
    environment: initial?.environment ?? 'sandbox',
    consumerKey: '',
    consumerSecret: '',
    passkey: '',
  })
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const supported =
    form.destinationType === 'paybill' || form.destinationType === 'till'
  const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm'
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(
        `/api/giving/settings?churchId=${churchId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not save giving settings.')
      setSaved(result)
      setForm((current) => ({
        ...current,
        consumerKey: '',
        consumerSecret: '',
        passkey: '',
      }))
      setMessage(
        result.ready
          ? 'Giving is enabled. Members can request an M-Pesa prompt.'
          : 'Payment destination saved. STK giving is currently disabled.'
      )
      router.refresh()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not save giving settings.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Where the church receives giving</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="giving-destination">Payment destination</Label>
            <select
              id="giving-destination"
              className={selectClass}
              value={form.destinationType}
              disabled={busy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  destinationType: event.target.value as DestinationType,
                  destinationNumber: '',
                  enabled: false,
                }))
              }
            >
              {DESTINATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DESTINATION_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="giving-destination-number">
              {DESTINATION_LABELS[form.destinationType]} number
            </Label>
            {supported ? (
              <Input
                id="giving-destination-number"
                inputMode="numeric"
                pattern="[0-9]{5,7}"
                maxLength={7}
                required
                value={form.destinationNumber}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, destinationNumber: event.target.value })
                }
              />
            ) : (
              <PhoneInput
                id="giving-destination-number"
                country="KE"
                required
                value={form.destinationNumber}
                disabled={busy}
                onChange={(destinationNumber) =>
                  setForm({ ...form, destinationNumber })
                }
              />
            )}
          </div>
          {form.destinationType === 'paybill' && (
            <div className="space-y-2">
              <Label htmlFor="giving-account">
                Account reference (optional)
              </Label>
              <Input
                id="giving-account"
                maxLength={12}
                value={form.accountReference}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, accountReference: event.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use a unique giving reference. Maximum 12
                characters.
              </p>
            </div>
          )}
          {!supported && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              This destination can be saved, but Pochi and personal mobile
              numbers cannot receive an STK collection through the current
              Safaricom Daraja connection. A payment provider supporting this
              destination must be connected before members can pay here by STK.
            </p>
          )}
        </CardContent>
      </Card>
      {supported && (
        <Card>
          <CardHeader>
            <CardTitle>M-Pesa connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the church’s STK-enabled Safaricom Daraja account. The
              receiving number and business shortcode must belong to that
              account.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="giving-environment">Payment environment</Label>
                <select
                  id="giving-environment"
                  className={selectClass}
                  disabled={busy}
                  value={form.environment}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      environment: event.target.value as
                        'sandbox' | 'production',
                      enabled: false,
                    })
                  }
                >
                  <option value="sandbox">Sandbox — test payments</option>
                  <option value="production">Production — real payments</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="giving-shortcode">Business shortcode</Label>
                <Input
                  id="giving-shortcode"
                  inputMode="numeric"
                  pattern="[0-9]{5,7}"
                  maxLength={7}
                  value={form.businessShortCode}
                  disabled={busy}
                  placeholder={
                    form.destinationType === 'paybill'
                      ? 'Defaults to paybill number'
                      : 'STK business shortcode'
                  }
                  onChange={(event) =>
                    setForm({ ...form, businessShortCode: event.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              For a till, the STK business shortcode may differ from the
              receiving till number.
            </p>
            {(['consumerKey', 'consumerSecret', 'passkey'] as const).map(
              (key, index) => (
                <div className="space-y-2" key={key}>
                  <Label htmlFor={`giving-${key}`}>
                    {['Consumer key', 'Consumer secret', 'STK passkey'][index]}
                  </Label>
                  <Input
                    id={`giving-${key}`}
                    type="password"
                    autoComplete="new-password"
                    maxLength={512}
                    value={form[key]}
                    disabled={busy}
                    placeholder={
                      saved?.hasCredentials
                        ? 'Saved — leave all three blank to keep'
                        : ''
                    }
                    onChange={(event) =>
                      setForm({ ...form, [key]: event.target.value })
                    }
                  />
                </div>
              )
            )}
            <p className="text-xs text-muted-foreground">
              Credentials are stored encrypted and are never returned to
              members. Re-enter all three when changing the environment or
              business shortcode.
            </p>
          </CardContent>
        </Card>
      )}
      {saved?.issues && saved.issues.length > 0 && (
        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="font-medium">To enable the saved connection:</p>
          <ul className="list-disc space-y-1 pl-5">
            {saved.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          disabled={busy || !supported}
          onChange={(event) =>
            setForm({ ...form, enabled: event.target.checked })
          }
        />
        Enable STK giving for members
      </label>
      {form.environment === 'sandbox' && supported && (
        <p className="text-sm text-muted-foreground">
          Sandbox payments produce clearly marked test receipts and do not count
          as church income.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save giving settings'}
      </Button>
    </form>
  )
}
