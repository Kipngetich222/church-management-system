import Link from 'next/link'
import { requirePermission } from '@/lib/auth/guard'
import { userCan } from '@/lib/auth/permissions'
import { financeEngine } from '@/lib/services/finance.service'
import { financeMoney, financeToday } from '@/lib/finance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FinancePlanStatus } from './FinancePlanForm'
import { GivingDownloadButton } from './GivingDownloadButton'

export async function FinancePlansPage({
  kind,
}: {
  kind: 'campaign' | 'pledge' | 'budget'
}) {
  const { user, churchId, role } = await requirePermission('finance:read'),
    engine = financeEngine(),
    canWrite = await userCan(churchId, role, 'finance:write')
  const campaigns =
    kind === 'campaign' ? await engine.campaigns(user.id, churchId) : []
  const pledges =
    kind === 'pledge' ? await engine.pledges(user.id, churchId) : []
  const budgets =
    kind === 'budget' ? await engine.budgets(user.id, churchId) : []
  const title =
    kind === 'campaign'
      ? 'Campaigns'
      : kind === 'pledge'
        ? 'Pledges'
        : 'Budgets'
  const path =
    kind === 'campaign'
      ? 'campaigns'
      : kind === 'pledge'
        ? 'pledges'
        : 'budgets'
  const count = campaigns.length + pledges.length + budgets.length
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {kind === 'pledge'
              ? 'Track total commitments, receipts and outstanding balances. Link each gift to its pledge when recording or making the payment.'
              : kind === 'budget'
                ? 'Compare paid expenses with the budget for each category, currency and period.'
                : 'Track designated giving goals. Test and voided gifts are excluded from progress.'}
          </p>
        </div>
        <div className="flex gap-2">
          <GivingDownloadButton
            url={`/api/finance/plans/export?churchId=${churchId}&kind=${kind}`}
            label="Download CSV"
          />
          {canWrite && (
            <Button asChild>
              <Link href={`/admin/finance/${path}/new`}>New {kind}</Link>
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                {c.name}
                <Badge variant="secondary">{c.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {c.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {c.start_date} to {c.end_date || 'Open-ended'}
              </p>
              <Progress
                aria-label="Campaign progress"
                value={Math.min(
                  100,
                  (Number(c.raised) / Number(c.goal_amount)) * 100
                )}
              />
              <p className="text-sm">
                Received {financeMoney(c.raised, c.currency)} of{' '}
                {financeMoney(c.goal_amount, c.currency)}
              </p>
              {canWrite && (
                <FinancePlanStatus
                  churchId={churchId}
                  kind="campaign"
                  id={c.id}
                  status={c.status}
                  updatedAt={c.updated_at}
                />
              )}
            </CardContent>
          </Card>
        ))}
        {pledges.map((p) => {
          const remaining = Math.max(
              0,
              Number(p.amount_pledged) - Number(p.received)
            ),
            overdue =
              p.status === 'active' &&
              remaining > 0 &&
              p.ends_on &&
              p.ends_on < financeToday()
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  {p.member_name || 'Former member'}
                  <Badge variant={overdue ? 'destructive' : 'secondary'}>
                    {p.status === 'cancelled'
                      ? 'Cancelled'
                      : remaining === 0
                        ? 'Fulfilled'
                        : overdue
                          ? 'Overdue'
                          : 'Active'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>{p.campaign_name || 'General pledge'}</p>
                <p className="text-xs text-muted-foreground">
                  {p.starts_on} to {p.ends_on || 'Open-ended'} ·{' '}
                  {p.frequency.replaceAll('_', ' ')}
                </p>
                <Progress
                  aria-label="Pledge progress"
                  value={Math.min(
                    100,
                    (Number(p.received) / Number(p.amount_pledged)) * 100
                  )}
                />
                <p className="text-sm">
                  Committed {financeMoney(p.amount_pledged, p.currency)} ·
                  Received {financeMoney(p.received, p.currency)}
                </p>
                <p className="font-medium">
                  Outstanding {financeMoney(remaining, p.currency)}
                </p>
                {p.notes && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {p.notes}
                  </p>
                )}
                {canWrite && (
                  <FinancePlanStatus
                    churchId={churchId}
                    kind="pledge"
                    id={p.id}
                    status={p.status}
                    updatedAt={p.updated_at}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
        {budgets.map((b) => {
          const remaining = Number(b.amount) - Number(b.spent)
          return (
            <Card key={b.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  {b.category_name}
                  <Badge variant={remaining < 0 ? 'destructive' : 'secondary'}>
                    {b.status === 'cancelled'
                      ? 'Cancelled'
                      : remaining < 0
                        ? 'Over budget'
                        : 'Active'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  {b.start_date} to {b.end_date}
                </p>
                <Progress
                  aria-label="Budget used"
                  value={Math.min(
                    100,
                    (Number(b.spent) / Number(b.amount)) * 100
                  )}
                />
                <p className="text-sm">
                  Spent {financeMoney(b.spent, b.currency)} of{' '}
                  {financeMoney(b.amount, b.currency)}
                </p>
                <p className="font-medium">
                  {remaining < 0 ? 'Over by' : 'Remaining'}{' '}
                  {financeMoney(Math.abs(remaining), b.currency)}
                </p>
                {b.notes && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {b.notes}
                  </p>
                )}
                {canWrite && (
                  <FinancePlanStatus
                    churchId={churchId}
                    kind="budget"
                    id={b.id}
                    status={b.status}
                    updatedAt={b.updated_at}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {count === 0 && (
        <p className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
          No {title.toLowerCase()} recorded yet.
        </p>
      )}
    </div>
  )
}
