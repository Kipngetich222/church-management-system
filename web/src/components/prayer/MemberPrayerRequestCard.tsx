import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PrayerRequestRow } from '@/lib/types/prayer'

export function MemberPrayerRequestCard({
  request,
  actions,
}: {
  request: PrayerRequestRow
  actions?: React.ReactNode
}) {
  const replies = (request.prayer_interactions ?? [])
    .filter((interaction) => !interaction.is_internal)
    .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
  const audience =
    request.type === 'counseling'
      ? 'Counselling'
      : request.audience === 'church'
        ? 'Whole church'
        : request.audience === 'person'
          ? 'Specific leader'
          : 'Pastors & leaders'
  const resolved = request.status === 'answered' || request.status === 'closed'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{request.title}</span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">{audience}</Badge>
            <Badge variant={resolved ? 'default' : 'secondary'}>
              {request.status.replace('_', ' ')}
            </Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm whitespace-pre-wrap">{request.body}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), 'MMM d, yyyy')}
        </p>
        {replies.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {replies.map((reply) => (
              <div key={reply.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>
        )}
        {actions}
      </CardContent>
    </Card>
  )
}
