'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { GIVING_TYPES, givingLabel } from '@/lib/giving'
import {
  financeAmount,
  financeToday,
  PAYMENT_LABELS,
  MAX_FINANCE_AMOUNT,
  type FinanceKind,
  type FinanceOptions,
} from '@/lib/finance'
import { financeSelectClass } from './FinanceFilters'

export function FinanceField({
  label,
  name,
  children,
}: {
  label: string
  name: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  )
}
export async function financeRequest(
  url: string,
  body: unknown,
  method = 'POST'
) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      data?.error || 'The record could not be saved. Please try again.'
    )
  return data
}
export function FinanceEntryForm({
  churchId,
  kind,
  options,
}: {
  churchId: string
  kind: FinanceKind
  options: FinanceOptions
}) {
  const router = useRouter(),
    requestId = useRef<string | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [currency, setCurrency] = useState('KES'),
    [member, setMember] = useState(''),
    [campaign, setCampaign] = useState(''),
    [pledge, setPledge] = useState('')
  const [category, setCategory] = useState(''),
    [status, setStatus] = useState('paid')
  const [date] = useState(() =>
    formatInTimeZone(new Date(), 'Africa/Nairobi', "yyyy-MM-dd'T'HH:mm")
  )
  const giving = kind === 'giving',
    expense = kind === 'expense'
  const campaigns = options.campaigns.filter((c) => c.currency === currency)
  const pledges = options.pledges.filter(
    (p) =>
      p.membership_id === member &&
      p.currency === currency &&
      Number(p.received) < Number(p.amount_pledged)
  )
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget),
      values = Object.fromEntries(form.entries())
    try {
      requestId.current ??= crypto.randomUUID()
      const payload: Record<string, unknown> = {
        ...values,
        churchId,
        kind,
        requestId: requestId.current,
        amount: financeAmount(Number(values.amount)),
        currency,
      }
      delete payload.file
      delete payload.paymentDate
      if (giving) {
        payload.membershipId = member || undefined
        payload.campaignId = campaign || undefined
        payload.pledgeId = pledge || undefined
      }
      if (expense) {
        payload.categoryId = category === '__new' ? undefined : category
        payload.status = status
      }
      if (!expense || status === 'paid')
        payload[giving ? 'givenAt' : expense ? 'spentAt' : 'receivedAt'] =
          fromZonedTime(
            String(values.paymentDate),
            'Africa/Nairobi'
          ).toISOString()
      const saved = await financeRequest('/api/finance/entries', payload)
      const file = form.get('file')
      let attachmentFailed = false
      if (file instanceof File && file.size) {
        try {
          const body = new FormData()
          body.set('churchId', churchId)
          body.set('kind', kind)
          body.set('id', saved.id)
          body.set('file', file)
          const uploaded = await fetch('/api/finance/documents', {
            method: 'POST',
            body,
            signal: AbortSignal.timeout(60_000),
          })
          if (!uploaded.ok) attachmentFailed = true
        } catch {
          attachmentFailed = true
        }
      }
      router.push(
        `/admin/finance/records/${kind}/${saved.id}${attachmentFailed ? '?attachment=failed' : ''}`
      )
      router.refresh()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The record could not be saved.'
      )
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {giving
              ? 'Record cash and giving received outside this system. Confirmed online giving is captured automatically.'
              : expense
                ? 'Record a payment already made or an unpaid bill. Use the supplier or employee name and service period to keep the filing complete.'
                : 'Record income such as grants, fundraising, rental fees or bank interest.'}
          </p>
          <fieldset disabled={busy} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField
                name="amount"
                label={
                  expense ? 'Amount paid / bill amount' : 'Amount received'
                }
              >
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  max={MAX_FINANCE_AMOUNT}
                  step="0.01"
                  required
                  placeholder="0.00"
                />
              </FinanceField>
              <FinanceField name="currency" label="Currency">
                <Input
                  id="currency"
                  name="currency"
                  pattern="[A-Z]{3}"
                  maxLength={3}
                  required
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value.toUpperCase())
                    setCampaign('')
                    setPledge('')
                  }}
                />
              </FinanceField>
              {giving ? (
                <>
                  <FinanceField name="type" label="Giving type">
                    <select
                      id="type"
                      name="type"
                      defaultValue="general"
                      className={financeSelectClass}
                    >
                      {GIVING_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {givingLabel(t)}
                        </option>
                      ))}
                    </select>
                  </FinanceField>
                  <FinanceField name="membershipId" label="Member (optional)">
                    <select
                      id="membershipId"
                      value={member}
                      className={financeSelectClass}
                      onChange={(e) => {
                        setMember(e.target.value)
                        setPledge('')
                      }}
                    >
                      <option value="">Anonymous or non-member</option>
                      {options.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </FinanceField>
                  {!member && (
                    <FinanceField
                      name="donorName"
                      label="Donor name (optional)"
                    >
                      <Input
                        id="donorName"
                        name="donorName"
                        maxLength={200}
                        placeholder="Leave blank for anonymous giving"
                      />
                    </FinanceField>
                  )}
                  <FinanceField
                    name="campaignId"
                    label="Campaign / designated fund (optional)"
                  >
                    <select
                      id="campaignId"
                      value={campaign}
                      onChange={(e) => {
                        setCampaign(e.target.value)
                        setPledge('')
                      }}
                      className={financeSelectClass}
                    >
                      <option value="">No campaign</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </FinanceField>
                  {member && (
                    <FinanceField
                      name="pledgeId"
                      label="Apply to a pledge (optional)"
                    >
                      <select
                        id="pledgeId"
                        value={pledge}
                        className={financeSelectClass}
                        onChange={(e) => {
                          const p = pledges.find((p) => p.id === e.target.value)
                          setPledge(e.target.value)
                          if (p) setCampaign(p.campaign_id || '')
                        }}
                      >
                        <option value="">No pledge</option>
                        {pledges.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.campaign_name || 'General pledge'} · {p.currency}{' '}
                            {(
                              Number(p.amount_pledged) - Number(p.received)
                            ).toFixed(2)}{' '}
                            remaining
                          </option>
                        ))}
                      </select>
                    </FinanceField>
                  )}
                </>
              ) : (
                <>
                  <FinanceField name="description" label="Description">
                    <Input
                      id="description"
                      name="description"
                      required
                      maxLength={500}
                      placeholder={
                        expense
                          ? 'e.g. Electricity bill for November'
                          : 'e.g. Hall rental for a community meeting'
                      }
                    />
                  </FinanceField>
                  <FinanceField
                    name="payee"
                    label={
                      expense
                        ? 'Paid to / supplier / employee'
                        : 'Received from'
                    }
                  >
                    <Input
                      id="payee"
                      name="payee"
                      required={expense}
                      maxLength={200}
                    />
                  </FinanceField>
                  {expense ? (
                    <>
                      <FinanceField name="categoryId" label="Expense category">
                        <select
                          id="categoryId"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          required
                          className={financeSelectClass}
                        >
                          <option value="">Choose a category</option>
                          {options.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          <option value="__new">Add a custom category…</option>
                        </select>
                      </FinanceField>
                      {category === '__new' && (
                        <FinanceField
                          name="categoryName"
                          label="New category name"
                        >
                          <Input
                            id="categoryName"
                            name="categoryName"
                            required
                            maxLength={120}
                            placeholder="e.g. Vehicle insurance"
                          />
                        </FinanceField>
                      )}
                      <FinanceField name="status" label="Payment status">
                        <select
                          id="status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className={financeSelectClass}
                        >
                          <option value="paid">Already paid</option>
                          <option value="unpaid">Unpaid bill</option>
                        </select>
                      </FinanceField>
                    </>
                  ) : (
                    <FinanceField name="category" label="Income category">
                      <Input
                        id="category"
                        name="category"
                        list="income-categories"
                        required
                        maxLength={120}
                        placeholder="Choose or type a category"
                      />
                      <datalist id="income-categories">
                        {[
                          'Grant',
                          'Fundraising',
                          'Rental income',
                          'Event fees',
                          'Bank interest',
                          'Refund received',
                          'Other income',
                        ].map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </FinanceField>
                  )}
                </>
              )}
              {(!expense || status === 'paid') && (
                <>
                  <FinanceField name="method" label="Payment method">
                    <select
                      id="method"
                      name="method"
                      defaultValue="cash"
                      className={financeSelectClass}
                    >
                      {Object.entries(PAYMENT_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </FinanceField>
                  <FinanceField
                    name="paymentDate"
                    label="Payment date & time (East Africa Time)"
                  >
                    <Input
                      id="paymentDate"
                      name="paymentDate"
                      type="datetime-local"
                      defaultValue={date}
                      required
                    />
                  </FinanceField>
                  <FinanceField
                    name="reference"
                    label="Payment reference (optional)"
                  >
                    <Input
                      id="reference"
                      name="reference"
                      maxLength={120}
                      placeholder="M-Pesa receipt, bank reference or cheque number"
                    />
                  </FinanceField>
                </>
              )}
            </div>
            {expense && (
              <div className="space-y-4 border-t pt-4">
                <h2 className="font-semibold">Filing details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FinanceField
                    name="invoiceNumber"
                    label="Invoice / bill number (optional)"
                  >
                    <Input
                      id="invoiceNumber"
                      name="invoiceNumber"
                      maxLength={120}
                    />
                  </FinanceField>
                  <FinanceField
                    name="invoiceDate"
                    label="Invoice / expense date"
                  >
                    <Input
                      id="invoiceDate"
                      name="invoiceDate"
                      type="date"
                      defaultValue={financeToday()}
                      required
                    />
                  </FinanceField>
                  <FinanceField name="dueDate" label="Due date (optional)">
                    <Input id="dueDate" name="dueDate" type="date" />
                  </FinanceField>
                  <div />
                  <FinanceField
                    name="periodStart"
                    label="Service / salary period from (optional)"
                  >
                    <Input id="periodStart" name="periodStart" type="date" />
                  </FinanceField>
                  <FinanceField
                    name="periodEnd"
                    label="Service / salary period to (optional)"
                  >
                    <Input id="periodEnd" name="periodEnd" type="date" />
                  </FinanceField>
                </div>
              </div>
            )}
            <FinanceField name="notes" label="Notes / filing information">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={4000}
                placeholder="Purpose, service details, approval reference or other helpful information"
              />
            </FinanceField>
            <FinanceField name="file" label="Supporting document (optional)">
              <input
                id="file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="block w-full text-sm"
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPEG or PNG, up to 10 MB. Only authorized finance staff can
                download these files. You can attach more files after saving.
              </p>
            </FinanceField>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy
                ? 'Saving…'
                : expense
                  ? status === 'unpaid'
                    ? 'Save unpaid bill'
                    : 'Record expense'
                  : giving
                    ? 'Record giving'
                    : 'Record income'}
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
