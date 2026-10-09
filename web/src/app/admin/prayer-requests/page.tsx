import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { requirePermission } from '@/lib/auth/guard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function AdminPrayerPage() {
  const ctx = await requirePermission('prayer:read')
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from('prayer_requests')
    .select(`
      id, title, body, type, status, visibility, created_at,
      church_memberships(users(full_name, email))
    `)
    .eq('church_id', ctx.churchId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prayer & Counseling</h1>
      <div className="space-y-3">
        {(requests ?? []).map((r: any) => (
          <Card key={r.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{r.title}</h3>
                <div className="flex gap-2">
                  <Badge variant="outline">{r.type}</Badge>
                  <Badge variant={r.status === 'open' ? 'secondary' : 'default'}>
                    {r.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
              <p className="text-sm">{r.body}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.church_memberships?.users?.full_name ?? 'Anonymous'}</span>
                <span>{format(new Date(r.created_at), 'MMM d, yyyy')}</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/prayer-requests/${r.id}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}