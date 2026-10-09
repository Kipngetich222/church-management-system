import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/guard'
import { getFinanceSummary } from '@/lib/services/finance.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'

export default async function AnalyticsPage() {
  const ctx = await requirePermission('analytics:*')
  if (ctx.church?.plan !== 'premium') {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Analytics is a <strong>Premium</strong> feature. Upgrade to unlock insights.
        </CardContent>
      </Card>
    )
  }

  const supabase = await createClient()
  const from = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const to = new Date().toISOString()

  const [summary, { data: memberGrowth }, { data: attendance }] = await Promise.all([
    getFinanceSummary(ctx.churchId, from, to),
    supabase.rpc('member_growth_by_month', { p_church_id: ctx.churchId }),
    supabase.rpc('attendance_by_event', { p_church_id: ctx.churchId }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Members</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{memberGrowth?.length ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">YTD income</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">KES {summary.totalIncome.toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">YTD expenses</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">KES {summary.totalExpense.toLocaleString()}</CardContent>
        </Card>
      </div>

      <AnalyticsCharts
        finance={summary}
        members={memberGrowth ?? []}
        attendance={attendance ?? []}
      />
    </div>
  )
}