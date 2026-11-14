'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PAYMENT_LABELS, type FinanceEntry } from '@/lib/finance'
import { FinanceField, financeRequest } from './FinanceEntryForm'
import { financeSelectClass } from './FinanceFilters'

export function FinanceRecordActions({ entry }: { entry: FinanceEntry }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const actions: [string, string][] = []
  if (entry.status === 'unpaid') actions.push(['pay', 'Mark bill paid'])
  if (entry.status === 'completed')
    actions.push(
      entry.reconciled_at
        ? ['unreconcile', 'Undo statement reconciliation']
        : ['reconcile', 'Reconcile with a statement']
    )
  if (entry.source === 'manual')
    actions.push(
      ['notes', 'Update filing notes'],
      ['void', 'Void an incorrect record']
    )
  const [action, setAction] = useState(actions[0]?.[0] ?? '')
  if (entry.status === 'voided' || !actions.length) return null
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const payload = {
        ...values,
        action,
        expectedUpdatedAt: entry.updated_at,
        ...(action === 'pay'
          ? {
              spentAt: fromZonedTime(
                String(values.paymentDate),
                'Africa/Nairobi'
              ).toISOString(),
            }
          : {}),
      }
      await financeRequest(
        `/api/finance/entries/${entry.kind}/${entry.id}?churchId=${entry.church_id}`,
        payload,
        'PATCH'
      )
      router.refresh()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The change could not be saved.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Update this record</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <FinanceField name="record-action" label="Action">
              <select
                id="record-action"
                className={financeSelectClass}
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                {actions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FinanceField>
            {action === 'pay' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FinanceField
                  name="paymentDate"
                  label="Paid on (East Africa Time)"
                >
                  <Input
                    id="paymentDate"
                    name="paymentDate"
                    type="datetime-local"
                    required
                    defaultValue={formatInTimeZone(
                      new Date(),
                      'Africa/Nairobi',
                      "yyyy-MM-dd'T'HH:mm"
                    )}
                  />
                </FinanceField>
                <FinanceField name="method" label="Payment method">
                  <select
                    id="method"
                    name="method"
                    className={financeSelectClass}
                    defaultValue="cash"
                  >
                    {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <FinanceField name="reference" label="Payment reference">
                  <Input id="reference" name="reference" maxLength={120} />
                </FinanceField>
              </div>
            )}
            {action === 'reconcile' && (
              <FinanceField
                name="statementReference"
                label="Bank / M-Pesa / cash statement reference"
              >
                <Input
                  id="statementReference"
                  name="statementReference"
                  maxLength={200}
                  required
                  placeholder="Statement date, account and line reference"
                />
              </FinanceField>
            )}
            {action === 'notes' && (
              <FinanceField name="notes" label="Filing notes">
                <Textarea
                  id="notes"
                  name="notes"
                  maxLength={4000}
                  rows={4}
                  defaultValue={entry.notes || ''}
                />
              </FinanceField>
            )}
            {action === 'void' && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm">
                Voiding excludes this record from totals and keeps its history.
                Record a replacement to correct an amount or allocation. If
                money was actually returned, record the refund as a separate
                payment instead.
              </p>
            )}
            <FinanceField name="reason" label="Reason for this change">
              <Textarea
                id="reason"
                name="reason"
                maxLength={1000}
                rows={2}
                required
                placeholder="Explain the correction, payment or statement check"
              />
            </FinanceField>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant={action === 'void' ? 'destructive' : 'default'}
            disabled={busy}
          >
            {busy
              ? 'Saving…'
              : action === 'void'
                ? 'Void record and keep history'
                : 'Save change'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
export function FinanceDocumentUpload({ entry }: { entry: FinanceEntry }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const form = event.currentTarget,
      data = new FormData(form)
    data.set('churchId', entry.church_id)
    data.set('kind', entry.kind)
    data.set('id', entry.id)
    try {
      const response = await fetch('/api/finance/documents', {
        method: 'POST',
        body: data,
        signal: AbortSignal.timeout(60_000),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed.')
      form.reset()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 border-t pt-4">
      <FinanceField
        name="supporting-file"
        label="Attach an invoice, receipt or approval"
      >
        <input
          id="supporting-file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png"
          disabled={busy}
          className="block w-full text-sm"
        />
      </FinanceField>
      <p className="text-xs text-muted-foreground">
        Private finance files. PDF, JPEG or PNG, up to 10 MB. Filed documents
        are retained with the record.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={busy}>
        {busy ? 'Uploading…' : 'Attach document'}
      </Button>
    </form>
  )
}
