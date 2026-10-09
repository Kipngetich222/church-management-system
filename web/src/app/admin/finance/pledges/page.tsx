import { getActiveChurch } from '@/lib/utils/church-scope'
import { listPledges } from '@/lib/services/finance.service'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default async function PledgesPage() {
  const { churchId } = await getActiveChurch()
  const pledges = await listPledges(churchId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pledges</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Pledged</TableHead>
                <TableHead>Given</TableHead>
                <TableHead className="w-48">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pledges.map((p: any) => {
                const given = (p.offerings ?? []).reduce(
                  (s: number, o: any) => s + Number(o.amount), 0
                )
                const pct = Math.min(100, (given / Number(p.amount_pledged)) * 100)
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.church_memberships?.users?.full_name ?? '—'}</TableCell>
                    <TableCell>{p.campaigns?.name ?? 'General'}</TableCell>
                    <TableCell>{p.currency} {Number(p.amount_pledged).toLocaleString()}</TableCell>
                    <TableCell>{p.currency} {given.toLocaleString()}</TableCell>
                    <TableCell>
                      <Progress value={pct} />
                      <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                    </TableCell>
                  </TableRow>
                )
              })}
              {pledges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No pledges recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}