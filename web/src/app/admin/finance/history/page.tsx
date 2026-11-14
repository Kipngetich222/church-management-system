import Link from 'next/link'
import { requirePermission } from '@/lib/auth/guard'
import {
  financeEngine,
  financeParams,
  financeSearchParams,
} from '@/lib/services/finance.service'
import { FinanceError } from '@/lib/finance'
import { FinanceAuditTable } from '@/components/finance/FinanceAuditTable'
import { GivingDownloadButton } from '@/components/finance/GivingDownloadButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
export default async function FinanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { churchId, user } = await requirePermission('finance:read'),
    query = financeSearchParams(await searchParams),
    { filters } = financeParams(query)
  const entity = query.get('entityId')
    ? { kind: query.get('entityType') ?? '', id: query.get('entityId')! }
    : undefined
  let history,
    error = ''
  try {
    history = await financeEngine().audit(user.id, churchId, filters, entity)
  } catch (e) {
    if (e instanceof FinanceError && e.status === 400) error = e.message
    else throw e
  }
  const download = new URLSearchParams(query)
  download.set('churchId', churchId)
  download.set('report', 'audit')
  download.set('format', 'csv')
  const link = (page: number) => {
    const q = new URLSearchParams(query)
    q.set('page', String(page))
    return `/admin/finance/history?${q}`
  }
  const pages = history
    ? Math.max(1, Math.ceil(history.total / history.pageSize))
    : 1
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finance change history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who recorded, paid, reconciled or voided a record, with the reason
            and saved before/after details. Dates below filter when the change
            was made.
          </p>
        </div>
        <GivingDownloadButton
          url={`/api/finance/report?${download}`}
          label="Download complete history CSV"
        />
      </div>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4"
      >
        <div className="space-y-1">
          <Label htmlFor="audit-from">Changes from (EAT)</Label>
          <Input
            id="audit-from"
            name="from"
            type="date"
            defaultValue={filters.from || ''}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to">Through (inclusive)</Label>
          <Input
            id="audit-to"
            name="to"
            type="date"
            defaultValue={filters.to || ''}
          />
        </div>
        {entity && (
          <>
            <input type="hidden" name="entityId" value={entity.id} />
            <input type="hidden" name="entityType" value={entity.kind} />
          </>
        )}
        <Button type="submit">Apply</Button>
        <Button asChild variant="ghost">
          <Link href="/admin/finance/history">Show all history</Link>
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {history && (
        <>
          <p className="text-sm text-muted-foreground">
            {history.total} changes · Page {history.page} of {pages}
          </p>
          <FinanceAuditTable rows={history.rows} />
          <div className="flex gap-2">
            {history.page > 1 && (
              <Button asChild variant="outline">
                <Link href={link(history.page - 1)}>Previous</Link>
              </Button>
            )}
            {history.page < pages && (
              <Button asChild variant="outline">
                <Link href={link(history.page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
