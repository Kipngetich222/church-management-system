import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

export function MemberGivingHistory({ offerings }: { offerings: any[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Your giving history</CardTitle></CardHeader>
      <CardContent>
        {offerings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No giving records yet.</p>
        ) : (
          <div className="divide-y">
            {offerings.map((o) => (
              <div key={o.id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="text-sm capitalize">{o.type.replace('_', ' ')}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(o.given_at), 'MMM d, yyyy')}
                    {o.receipt_number && <> · {o.receipt_number}</>}
                  </div>
                </div>
                <span className="font-medium">{o.currency} {Number(o.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}