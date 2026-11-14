import Link from 'next/link'
import { requirePermission } from '@/lib/auth/guard'
import {
  financeEngine,
  financeParams,
  financeSearchParams,
} from '@/lib/services/finance.service'
import {
  FinanceError,
  financeMoney,
  financePeriod,
  type FinanceSummary,
} from '@/lib/finance'
import { FinanceFilters } from '@/components/finance/FinanceFilters'
import { GivingDownloadButton } from '@/components/finance/GivingDownloadButton'
import { FinanceChart } from '@/components/finance/FinanceChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { churchId, user } = await requirePermission('finance:read')
  const filters = financeParams(financeSearchParams(await searchParams)).filters
  let period = financePeriod(),
    summary: FinanceSummary | undefined,
    error = ''
  try {
    ;({ period, summary } = await financeEngine().summary(
      user.id,
      churchId,
      filters
    ))
  } catch (e) {
    if (e instanceof FinanceError && e.status === 400) error = e.message
    else throw e
  }
  const query = new URLSearchParams({
    churchId,
    from: period.from,
    to: period.to,
    currency: period.currency,
  })
  const cards = summary
    ? ([
        ['Income received', summary.totalIncome],
        ['Expenses paid', summary.totalExpense],
        ['Net movement', summary.netBalance],
        ['Unpaid bills at period end', summary.outstandingBills],
      ] as const)
    : []
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finance overview & reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose any period to review cash received, spending, bills and
            filing checks.
          </p>
        </div>
        {summary && (
          <div className="flex gap-2">
            <GivingDownloadButton
              url={`/api/finance/report?${query}&format=pdf`}
              label="Summary PDF"
            />
            <GivingDownloadButton
              url={`/api/finance/report?${query}&format=csv`}
              label="Summary CSV"
            />
          </div>
        )}
      </div>
      <FinanceFilters
        filters={error ? filters : period}
        report
        resetPath="/admin/finance"
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, amount]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold tabular-nums">
                  {financeMoney(amount, period.currency)}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
              <div>
                <div className="font-medium">
                  Recorded opening:{' '}
                  {financeMoney(summary.openingBalance, period.currency)}
                </div>
                <div className="font-medium">
                  Recorded closing:{' '}
                  {financeMoney(summary.closingBalance, period.currency)}
                </div>
                <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                  Cash totals include received and paid entries only. Balances
                  reflect records held here; reconcile them with your bank,
                  M-Pesa and cash statements. Corrections restate the affected
                  period and remain in the history.
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  {summary.automaticCount} automatic · {summary.manualCount}{' '}
                  manual · {summary.excludedCount} excluded records
                </p>
                <Button asChild variant="outline">
                  <Link
                    href={`/admin/finance/transactions?from=${period.from}&to=${period.to}&currency=${period.currency}`}
                  >
                    Review transactions & download details
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Overdue bills at period end
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {financeMoney(summary.overdueBills, period.currency)}
                </div>
                <Link
                  className="text-sm text-primary underline"
                  href={`/admin/finance/expenses?status=unpaid&currency=${period.currency}`}
                >
                  Review current unpaid bills
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Statement reconciliation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {summary.unreconciledCount} to check
                </div>
                <Link
                  className="text-sm text-primary underline"
                  href={`/admin/finance/transactions?from=${period.from}&to=${period.to}&currency=${period.currency}&status=completed&reconciled=no`}
                >
                  Match records to statements
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Expense filing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {summary.missingDocumentsCount} missing documents
                </div>
                <Link
                  className="text-sm text-primary underline"
                  href={`/admin/finance/expenses?from=${period.from}&to=${period.to}&currency=${period.currency}&status=completed&documents=missing`}
                >
                  Review receipts and invoices
                </Link>
              </CardContent>
            </Card>
          </div>
          <FinanceChart summary={summary} />
        </>
      )}
    </div>
  )
}
