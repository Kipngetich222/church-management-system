import { getActiveChurch } from '@/lib/utils/church-scope'
import { listCampaigns } from '@/lib/services/finance.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function CampaignsPage() {
  const { churchId } = await getActiveChurch()
  const campaigns = await listCampaigns(churchId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button asChild>
          <Link href="/admin/finance/campaigns/new">
            <Plus className="h-4 w-4 mr-2" /> New campaign
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {campaigns.map((c: any) => {
          const raised = (c.offerings ?? []).reduce(
            (s: number, o: any) => s + Number(o.amount),
            0
          )
          const pct = Math.min(100, (raised / Number(c.goal_amount)) * 100)
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {c.name}
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                <Progress value={pct} />
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{c.currency} {raised.toLocaleString()}</span>
                  <span className="text-muted-foreground">of {c.currency} {Number(c.goal_amount).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {campaigns.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              No campaigns yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}