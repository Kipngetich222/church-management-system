import { getActiveChurch } from '@/lib/utils/church-scope'
import { listExpenses } from '@/lib/services/finance.service'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function ExpensesPage() {
  const { churchId } = await getActiveChurch()
  const expenses = await listExpenses(churchId)
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {expenses.length} record{expenses.length !== 1 ? 's' : ''} · Total KES {total.toLocaleString()}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/finance/expenses/new">
            <Plus className="h-4 w-4 mr-2" /> Record expense
          </Link>
        </Button>
      </div>

      <div className="border rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{format(new Date(e.spent_at), 'MMM d, yyyy')}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell>
                  {e.expense_categories && (
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: `${e.expense_categories.color}20`,
                        color: e.expense_categories.color,
                        borderColor: `${e.expense_categories.color}40`,
                      }}
                    >
                      {e.expense_categories.name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm capitalize">{e.method.replace('_', ' ')}</TableCell>
                <TableCell className="text-right font-medium">
                  {e.currency} {Number(e.amount).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No expenses recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}