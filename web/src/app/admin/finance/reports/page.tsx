import { getActiveChurch } from '@/lib/utils/church-scope'
import { getFinanceSummary } from '@/lib/services/finance.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinanceChart } from '@/components/finance/FinanceChart'
import { Download } from 'lucide-react'

export default async function FinanceReportsPage() {
  const { churchId, church, role } = await getActiveChurch()
  const from = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const to = new Date().toISOString()
  const summary = await getFinanceSummary(churchId, from, to)
  const isPremium = church?.plan === 'premium'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Finance reports</h1>
        <Button variant="outline" asChild>
          <a href={`/api/finance/report?churchId=${churchId}&from=${from}&to=${to}`}>
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total income</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">KES {summary.totalIncome.toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total expenses</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">KES {summary.totalExpense.toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Net balance</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">KES {summary.netBalance.toLocaleString()}</CardContent>
        </Card>
      </div>

      {isPremium ? (
        <FinanceChart summary={summary} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Charts are a <strong>Premium</strong> feature. You can still export PDF reports.
          </CardContent>
        </Card>
      )}
    </div>
  )
}