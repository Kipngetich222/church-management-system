import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default async function MessageHistoryPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('message_campaigns')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Message history</h1>

      <div className="space-y-3">
        {(campaigns ?? []).map((c: any) => (
          <Card key={c.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), 'MMM d, yyyy · h:mm a')}
                  </div>
                  <p className="mt-2 text-sm line-clamp-3">{c.body}</p>
                </div>
                <Badge variant={
                  c.status === 'sent' ? 'default' :
                  c.status === 'scheduled' ? 'secondary' : 'outline'
                }>
                  {c.status}
                </Badge>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{c.total_recipients} recipients</span>
                <span>{c.sent_count} sent</span>
                {c.failed_count > 0 && (
                  <span className="text-destructive">{c.failed_count} failed</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!campaigns || campaigns.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No messages sent yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}