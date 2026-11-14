import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GivingDownloadButton } from './GivingDownloadButton'
import {
  financeCategory,
  financeMoney,
  financePaymentLabel,
  SOURCE_LABELS,
  type FinanceFilters,
  type FinanceHistory,
} from '@/lib/finance'

export function FinanceRegister({
  churchId,
  history,
  filters,
  path,
}: {
  churchId: string
  history: FinanceHistory
  filters: FinanceFilters
  path: string
}) {
  const params = new URLSearchParams({ churchId, report: 'transactions' })
  for (const [key, value] of Object.entries(filters))
    if (
      value !== undefined &&
      value !== '' &&
      !['page', 'pageSize'].includes(key)
    )
      params.set(key, String(value))
  const pageLink = (page: number) => {
    const query = new URLSearchParams(params)
    query.delete('churchId')
    query.delete('report')
    query.set('page', String(page))
    query.set('pageSize', String(history.pageSize))
    return `${path}?${query}`
  }
  const pages = Math.max(1, Math.ceil(history.total / history.pageSize))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {history.total.toLocaleString()} matching records. Downloads include
          every matching record.
        </p>
        <div className="flex gap-2">
          <GivingDownloadButton
            url={`/api/finance/report?${params}&format=csv`}
            label="Download CSV"
          />
          <GivingDownloadButton
            url={`/api/finance/report?${params}&format=pdf`}
            label="Download PDF"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / record</TableHead>
              <TableHead>Category & description</TableHead>
              <TableHead>Donor / payee</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.rows.map((row) => (
              <TableRow key={row.entry_key}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={`/admin/finance/records/${row.kind}/${row.id}`}
                  >
                    {row.voucher_number || 'View record'}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {row.entry_date}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{financeCategory(row)}</div>
                  <div className="max-w-72 truncate text-xs text-muted-foreground">
                    {row.kind === 'giving'
                      ? row.campaign_name || 'Giving'
                      : row.description}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.document_count > 0
                      ? `${row.document_count} supporting file${row.document_count === 1 ? '' : 's'}`
                      : row.legacy_receipt_url
                        ? 'Previously filed receipt'
                        : 'No supporting documents'}
                  </div>
                </TableCell>
                <TableCell>
                  {row.payee || 'Anonymous'}
                  {row.invoice_number && (
                    <div className="text-xs text-muted-foreground">
                      Invoice: {row.invoice_number}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{financePaymentLabel(row)}</div>
                  <div className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[row.source]}
                  </div>
                  <div className="font-mono text-xs">{row.reference}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === 'voided' || row.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {row.status === 'completed'
                      ? row.direction === 'expense'
                        ? 'Paid'
                        : 'Received'
                      : row.status === 'review'
                        ? 'Needs review'
                        : row.status}
                  </Badge>
                  {row.status === 'unpaid' && row.due_date && (
                    <div className="mt-1 text-xs">Due {row.due_date}</div>
                  )}
                  {row.reconciled_at && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reconciled
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {row.direction === 'expense' ? '− ' : '+ '}
                  {financeMoney(row.amount, row.currency)}
                </TableCell>
              </TableRow>
            ))}
            {!history.rows.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  No records match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          Page {history.page} of {pages}
        </span>
        <div className="flex gap-2">
          {history.page > 1 && (
            <Button variant="outline" asChild>
              <Link href={pageLink(history.page - 1)}>Previous</Link>
            </Button>
          )}
          {history.page < pages && (
            <Button variant="outline" asChild>
              <Link href={pageLink(history.page + 1)}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
