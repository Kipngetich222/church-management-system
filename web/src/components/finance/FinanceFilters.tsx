import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  FINANCE_STATUSES,
  PAYMENT_LABELS,
  SOURCE_LABELS,
  type ExpenseCategory,
  type FinanceCampaign,
  type FinanceFilters as Filters,
} from '@/lib/finance'
import { GIVING_TYPES, givingLabel } from '@/lib/giving'

export const financeSelectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'
export function FinanceFilters({
  filters,
  categories = [],
  campaigns = [],
  report = false,
  kind,
  resetPath = '/admin/finance/transactions',
}: {
  filters: Filters
  categories?: ExpenseCategory[]
  campaigns?: FinanceCampaign[]
  report?: boolean
  kind?: string
  resetPath?: string
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4"
      aria-label="Finance filters"
    >
      <div className="space-y-1">
        <Label htmlFor="finance-from">From (EAT)</Label>
        <Input
          id="finance-from"
          name="from"
          type="date"
          defaultValue={filters.from || ''}
          required={report}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="finance-to">To (inclusive)</Label>
        <Input
          id="finance-to"
          name="to"
          type="date"
          defaultValue={filters.to || ''}
          required={report}
        />
      </div>
      <div className="w-24 space-y-1">
        <Label htmlFor="finance-currency">Currency</Label>
        <Input
          id="finance-currency"
          name="currency"
          placeholder={report ? 'KES' : 'All'}
          maxLength={3}
          pattern="[A-Za-z]{3}"
          defaultValue={filters.currency || ''}
          required={report}
        />
      </div>
      {!report && (
        <>
          {!kind && (
            <div className="space-y-1">
              <Label htmlFor="finance-kind">Record type</Label>
              <select
                id="finance-kind"
                name="kind"
                defaultValue={filters.kind || ''}
                className={financeSelectClass}
              >
                <option value="">All records</option>
                <option value="giving">Giving</option>
                <option value="expense">Expenses</option>
                <option value="income">Other income</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="finance-status">Status</Label>
            <select
              id="finance-status"
              name="status"
              defaultValue={filters.status || ''}
              className={financeSelectClass}
            >
              <option value="">All statuses</option>
              {FINANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'completed'
                    ? 'Received / paid'
                    : s === 'review'
                      ? 'Needs review'
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="finance-source">Source</Label>
            <select
              id="finance-source"
              name="source"
              defaultValue={filters.source || ''}
              className={financeSelectClass}
            >
              <option value="">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="finance-method">Payment method</Label>
            <select
              id="finance-method"
              name="method"
              defaultValue={filters.method || ''}
              className={financeSelectClass}
            >
              <option value="">All methods</option>
              {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {kind !== 'expense' && kind !== 'income' && (
            <div className="space-y-1">
              <Label htmlFor="finance-type">Giving type</Label>
              <select
                id="finance-type"
                name="type"
                defaultValue={filters.type || ''}
                className={financeSelectClass}
              >
                <option value="">All giving types</option>
                {GIVING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {givingLabel(t)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind !== 'expense' && kind !== 'income' && campaigns.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="finance-campaign">Campaign / fund</Label>
              <select
                id="finance-campaign"
                name="campaignId"
                defaultValue={filters.campaignId || ''}
                className={financeSelectClass}
              >
                <option value="">All campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind !== 'income' && categories.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="finance-category">Expense category</Label>
              <select
                id="finance-category"
                name="categoryId"
                defaultValue={filters.categoryId || ''}
                className={financeSelectClass}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="finance-reconciled">Statement check</Label>
            <select
              id="finance-reconciled"
              name="reconciled"
              defaultValue={filters.reconciled || ''}
              className={financeSelectClass}
            >
              <option value="">All records</option>
              <option value="yes">Reconciled</option>
              <option value="no">Unreconciled</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="finance-documents">Supporting documents</Label>
            <select
              id="finance-documents"
              name="documents"
              defaultValue={filters.documents || ''}
              className={financeSelectClass}
            >
              <option value="">All records</option>
              <option value="missing">Missing documents</option>
              <option value="attached">Documents filed</option>
            </select>
          </div>
          <div className="min-w-52 flex-1 space-y-1">
            <Label htmlFor="finance-search">Search</Label>
            <Input
              id="finance-search"
              name="search"
              maxLength={120}
              placeholder="Payee, invoice, reference, notes…"
              defaultValue={filters.search || ''}
            />
          </div>
        </>
      )}
      <Button type="submit">{report ? 'View report' : 'Apply filters'}</Button>
      <Button asChild variant="ghost">
        <Link href={resetPath}>Reset</Link>
      </Button>
    </form>
  )
}
