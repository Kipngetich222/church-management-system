'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  financeAmount,
  financeToday,
  MAX_FINANCE_AMOUNT,
  type FinanceOptions,
} from '@/lib/finance'
import { FinanceField, financeRequest } from './FinanceEntryForm'
import { financeSelectClass } from './FinanceFilters'

export function FinancePlanForm({
  churchId,
  kind,
  options,
}: {
  churchId: string
  kind: 'campaign' | 'pledge' | 'budget'
  options: FinanceOptions
}) {
  const router = useRouter(),
    request = useRef<string | null>(null),
    [currency, setCurrency] = useState('KES'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const amountKey =
    kind === 'campaign'
      ? 'goalAmount'
      : kind === 'pledge'
        ? 'amountPledged'
        : 'amount'
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      request.current ??= crypto.randomUUID()
      await financeRequest('/api/finance/plans', {
        ...values,
        kind,
        churchId,
        requestId: request.current,
        currency,
        [amountKey]: financeAmount(Number(values[amountKey])),
      })
      router.push(
        `/admin/finance/${kind === 'pledge' ? 'pledges' : kind === 'budget' ? 'budgets' : 'campaigns'}`
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plan could not be saved.')
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            {kind === 'campaign' && (
              <FinanceField name="name" label="Campaign name">
                <Input
                  id="name"
                  name="name"
                  maxLength={200}
                  required
                  placeholder="e.g. New sanctuary building fund"
                />
              </FinanceField>
            )}
            {kind === 'pledge' && (
              <FinanceField name="membershipId" label="Member">
                <select
                  id="membershipId"
                  name="membershipId"
                  className={financeSelectClass}
                  required
                  defaultValue=""
                >
                  <option value="">Select a member</option>
                  {options.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </FinanceField>
            )}
            {kind === 'budget' && (
              <FinanceField name="categoryId" label="Expense category">
                <select
                  id="categoryId"
                  name="categoryId"
                  className={financeSelectClass}
                  required
                  defaultValue=""
                >
                  <option value="">Select a category</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FinanceField>
            )}
            <FinanceField name="currency" label="Currency">
              <Input
                id="currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                pattern="[A-Z]{3}"
                maxLength={3}
                required
              />
            </FinanceField>
            <FinanceField
              name={amountKey}
              label={
                kind === 'pledge'
                  ? 'Total commitment for this pledge'
                  : kind === 'budget'
                    ? 'Budget for the entire period'
                    : 'Campaign goal'
              }
            >
              <Input
                id={amountKey}
                name={amountKey}
                type="number"
                step="0.01"
                min="0.01"
                max={MAX_FINANCE_AMOUNT}
                required
              />
            </FinanceField>
            {kind === 'pledge' && (
              <>
                <FinanceField name="campaignId" label="Campaign (optional)">
                  <select
                    id="campaignId"
                    name="campaignId"
                    key={currency}
                    defaultValue=""
                    className={financeSelectClass}
                  >
                    <option value="">General pledge</option>
                    {options.campaigns
                      .filter((c) => c.currency === currency)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </FinanceField>
                <FinanceField
                  name="frequency"
                  label="Planned installment frequency"
                >
                  <select
                    id="frequency"
                    name="frequency"
                    className={financeSelectClass}
                    defaultValue="one_time"
                  >
                    {[
                      ['one_time', 'One time'],
                      ['weekly', 'Weekly'],
                      ['monthly', 'Monthly'],
                      ['quarterly', 'Quarterly'],
                      ['annually', 'Annually'],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </FinanceField>
              </>
            )}
            <FinanceField name="plan-start" label="Start date">
              <Input
                id="plan-start"
                name={kind === 'pledge' ? 'startsOn' : 'startDate'}
                type="date"
                defaultValue={financeToday()}
                required
              />
            </FinanceField>
            <FinanceField
              name="plan-end"
              label={
                kind === 'pledge'
                  ? 'Due / end date (optional)'
                  : kind === 'campaign'
                    ? 'End date (optional)'
                    : 'End date'
              }
            >
              <Input
                id="plan-end"
                name={kind === 'pledge' ? 'endsOn' : 'endDate'}
                type="date"
                required={kind === 'budget'}
              />
            </FinanceField>
            <div className="sm:col-span-2">
              <FinanceField
                name="plan-notes"
                label={kind === 'campaign' ? 'Description' : 'Notes'}
              >
                <Textarea
                  id="plan-notes"
                  name={kind === 'campaign' ? 'description' : 'notes'}
                  maxLength={4000}
                  rows={3}
                />
              </FinanceField>
            </div>
          </fieldset>
          <p className="text-sm text-muted-foreground">
            {kind === 'pledge'
              ? 'This is the total commitment, not the installment amount. Pledges are not income until a received gift is linked to them.'
              : kind === 'budget'
                ? 'Paid expenses in this category and currency count against this budget. Periods for the same category and currency cannot overlap.'
                : 'Only received giving in the campaign currency counts toward the goal.'}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : `Create ${kind}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
export function FinancePlanStatus({
  churchId,
  kind,
  id,
  status,
  updatedAt,
}: {
  churchId: string
  kind: 'campaign' | 'pledge' | 'budget'
  id: string
  status: string
  updatedAt: string
}) {
  const router = useRouter(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (status === 'cancelled') return null
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      await financeRequest(
        `/api/finance/plans/${kind}/${id}?churchId=${churchId}`,
        { ...values, expectedUpdatedAt: updatedAt },
        'PATCH'
      )
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The status could not be saved.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(!open)}
      >
        {kind === 'campaign' ? 'Change status' : `Cancel ${kind}`}
      </Button>
      {open && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
          <select
            aria-label="New status"
            name="status"
            defaultValue={kind === 'campaign' ? status : 'cancelled'}
            className={financeSelectClass}
          >
            {(kind === 'campaign'
              ? ['active', 'paused', 'completed', 'cancelled']
              : ['cancelled']
            ).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            name="reason"
            aria-label="Reason for status change"
            placeholder="Reason (required)"
            maxLength={1000}
            required
          />
          <p className="text-xs text-muted-foreground">
            Cancelling keeps the history and all associated payments.
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Saving…' : 'Save status'}
          </Button>
        </form>
      )}
    </div>
  )
}
