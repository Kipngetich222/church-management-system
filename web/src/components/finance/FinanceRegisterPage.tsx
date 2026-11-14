import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requirePermission } from '@/lib/auth/guard'
import { userCan } from '@/lib/auth/permissions'
import {
  financeEngine,
  financeParams,
  financeSearchParams,
} from '@/lib/services/finance.service'
import {
  FinanceError,
  type FinanceFilters,
  type FinanceKind,
} from '@/lib/finance'
import { FinanceFilters as FilterForm } from './FinanceFilters'
import { FinanceRegister } from './FinanceRegister'
import { Button } from '@/components/ui/button'

export async function FinanceRegisterPage({
  searchParams,
  kind,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  kind?: FinanceKind
}) {
  const { churchId, user, role } = await requirePermission('finance:read'),
    engine = financeEngine()
  const filters: FinanceFilters = {
    ...financeParams(financeSearchParams(await searchParams)).filters,
    ...(kind ? { kind } : {}),
  }
  const path =
    kind === 'expense'
      ? '/admin/finance/expenses'
      : kind === 'income'
        ? '/admin/finance/income'
        : '/admin/finance/transactions'
  const title =
    kind === 'expense'
      ? 'Expenses & bills'
      : kind === 'income'
        ? 'Other income'
        : 'Finance transactions'
  const [categories, campaigns, canWrite] = await Promise.all([
    engine.categories(user.id, churchId),
    !kind || kind === 'giving'
      ? engine.campaigns(user.id, churchId)
      : Promise.resolve([]),
    userCan(churchId, role, 'finance:write'),
  ])
  let history,
    error = ''
  try {
    history = await engine.history(user.id, churchId, filters)
  } catch (e) {
    if (e instanceof FinanceError && e.status === 400) error = e.message
    else throw e
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {kind === 'expense'
              ? 'File electricity, transport, salaries and other costs. Confirmed system purchases appear automatically; unpaid bills count as spending when you mark them paid.'
              : kind === 'income'
                ? 'Record grants, fundraising, rent and other receipts. Paid event registrations appear here automatically; voluntary giving is recorded under Giving.'
                : 'Review giving, other income and spending together, including their source and payment references.'}
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link
              href={
                kind === 'expense'
                  ? '/admin/finance/expenses/new'
                  : kind === 'income'
                    ? '/admin/finance/income/new'
                    : '/admin/finance/offerings/new'
              }
            >
              <Plus className="h-4 w-4" />
              {kind === 'expense'
                ? 'Record expense / bill'
                : kind === 'income'
                  ? 'Record income'
                  : 'Record giving'}
            </Link>
          </Button>
        )}
      </div>
      <FilterForm
        filters={filters}
        kind={kind}
        categories={categories}
        campaigns={campaigns}
        resetPath={path}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {history && (
        <FinanceRegister
          churchId={churchId}
          history={history}
          filters={filters}
          path={path}
        />
      )}
    </div>
  )
}
