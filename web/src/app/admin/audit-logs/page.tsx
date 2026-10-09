import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Card, CardContent } from '@/components/ui/card'

export default async function AuditLogsPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('audit_logs')
    .select(
      'id, action, entity_type, metadata, created_at, users(full_name, email)'
    )
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit logs</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="divide-y">
            {(logs ?? []).map((log) => (
              <div key={log.id} className="py-3 flex justify-between text-sm">
                <div>
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    on {log.entity_type}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    by {log.users?.full_name ?? log.users?.email}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {log.created_at
                    ? new Date(log.created_at).toLocaleString()
                    : ''}
                </span>
              </div>
            ))}
            {(!logs || logs.length === 0) && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No activity yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
