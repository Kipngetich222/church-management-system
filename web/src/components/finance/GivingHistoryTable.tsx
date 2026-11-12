'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  GIVING_TYPES,
  givingLabel,
  type GivingHistory,
  type GivingHistoryRow,
} from '@/lib/giving'
import { GivingDownloadButton } from './GivingDownloadButton'

type Filters = { type: string; status: string; from: string; to: string }
const emptyFilters: Filters = { type: '', status: '', from: '', to: '' }
const STATUS_LABELS: Record<GivingHistoryRow['status'], string> = {
  completed: 'Completed',
  test: 'Test payment',
  pending: 'Pending',
  failed: 'Failed',
  review: 'Needs review',
}
export function GivingHistoryTable({
  churchId,
  scope,
  initial,
}: {
  churchId: string
  scope: 'mine' | 'church'
  initial: GivingHistory
}) {
  const [history, setHistory] = useState(initial)
  const [draft, setDraft] = useState(emptyFilters),
    [applied, setApplied] = useState(emptyFilters)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const latest = useRef(0)
  const parameters = useCallback(
    (page: number, filters: Filters) =>
      new URLSearchParams({
        churchId,
        scope,
        page: String(page),
        ...filters,
      }),
    [churchId, scope]
  )
  const load = useCallback(
    async (page: number, filters: Filters) => {
      const sequence = ++latest.current
      setBusy(true)
      setError('')
      try {
        const response = await fetch(
          `/api/giving/history?${parameters(page, filters)}`,
          { cache: 'no-store', signal: AbortSignal.timeout(25_000) }
        )
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error || 'Could not load giving history.')
        if (sequence === latest.current) {
          setHistory(result)
          setApplied(filters)
        }
      } catch (error) {
        if (sequence === latest.current)
          setError(
            error instanceof Error
              ? error.message
              : 'Could not load giving history.'
          )
      } finally {
        if (sequence === latest.current) setBusy(false)
      }
    },
    [parameters]
  )
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible')
        void load(history.page, applied)
    }
    window.addEventListener('giving-updated', refresh)
    const timer = setInterval(refresh, 30_000)
    return () => {
      window.removeEventListener('giving-updated', refresh)
      clearInterval(timer)
    }
  }, [history.page, applied, load])
  async function checkPayment(paymentId: string) {
    if (checkingId) return
    setCheckingId(paymentId)
    setError('')
    try {
      const response = await fetch(
        `/api/giving/payments/${paymentId}/verify?churchId=${churchId}`,
        { method: 'POST', signal: AbortSignal.timeout(55_000) }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Confirmation is still pending.')
      await load(history.page, applied)
      window.dispatchEvent(new Event('giving-updated'))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not check payment status.'
      )
    } finally {
      setCheckingId(null)
    }
  }
  const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm'
  const pages = Math.max(1, Math.ceil(history.total / history.pageSize))
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>
            {scope === 'mine' ? 'Your giving history' : 'Church giving history'}
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {history.total.toLocaleString()} matching record
            {history.total === 1 ? '' : 's'}. Only completed payments count as
            income.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => load(history.page, applied)}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <GivingDownloadButton
            url={`/api/giving/export?${parameters(1, applied)}`}
            label="Download CSV"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void load(1, draft)
          }}
        >
          <div className="min-w-36 flex-1 space-y-1">
            <Label htmlFor="history-type">Giving type</Label>
            <select
              id="history-type"
              value={draft.type}
              className={selectClass}
              onChange={(event) =>
                setDraft({ ...draft, type: event.target.value })
              }
            >
              <option value="">All types</option>
              {GIVING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {givingLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-32 flex-1 space-y-1">
            <Label htmlFor="history-status">Status</Label>
            <select
              id="history-status"
              value={draft.status}
              className={selectClass}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value })
              }
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-from">From</Label>
            <Input
              id="history-from"
              type="date"
              value={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-to">To</Label>
            <Input
              id="history-to"
              type="date"
              min={draft.from || undefined}
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>
            Apply filters
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border" aria-busy={busy}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {scope === 'church' && <TableHead>Member</TableHead>}
                <TableHead>Giving</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(row.given_at).toLocaleDateString('en-KE', {
                      timeZone: 'Africa/Nairobi',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  {scope === 'church' && (
                    <TableCell>
                      <div>{row.donor_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.phone || row.donor_email}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div>{givingLabel(row.type)}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.method === 'mpesa'
                        ? 'M-Pesa'
                        : row.method.replaceAll('_', ' ')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === 'completed'
                          ? 'default'
                          : row.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {STATUS_LABELS[row.status]}
                    </Badge>
                    {row.error && (
                      <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                        {row.error}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">
                    {row.currency}{' '}
                    {Number(row.amount).toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    {row.receipt_number &&
                    row.offering_id &&
                    ['completed', 'test'].includes(row.status) ? (
                      <div className="space-y-1">
                        <span className="block font-mono text-xs">
                          {row.receipt_number}
                        </span>
                        <GivingDownloadButton
                          url={`/api/giving/receipts/${row.offering_id}?churchId=${churchId}`}
                        />
                      </div>
                    ) : row.payment_id &&
                      ['pending', 'review'].includes(row.status) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={checkingId !== null}
                        onClick={() => checkPayment(row.payment_id!)}
                      >
                        {checkingId === row.payment_id
                          ? 'Checking…'
                          : 'Check status'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Not available
                      </span>
                    )}
                    {row.reference && (
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">
                        {row.reference}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!history.rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={scope === 'church' ? 6 : 5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No giving records match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Page {history.page} of {pages}. Downloads include all matching
            records.
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || history.page <= 1}
              onClick={() => load(history.page - 1, applied)}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || history.page >= pages}
              onClick={() => load(history.page + 1, applied)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
