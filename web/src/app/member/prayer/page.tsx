import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { PrayerRequestForm } from '@/components/prayer/PrayerRequestForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default async function PrayerPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  const { data: requests } = await supabase
    .from('prayer_requests')
    .select('id, title, body, type, status, created_at, prayer_interactions(id, body, created_at, is_internal)')
    .eq('membership_id', membership!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prayer & Counseling</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <PrayerRequestForm churchId={churchId} membershipId={membership!.id} />

        <div className="space-y-3">
          <h2 className="font-semibold">Your requests</h2>
          {(requests ?? []).map((r: any) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {r.title}
                  <Badge variant={
                    r.status === 'closed' || r.status === 'answered' ? 'default' : 'secondary'
                  }>
                    {r.status.replace('_', ' ')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{r.body}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), 'MMM d, yyyy')}
                </p>
                {(r.prayer_interactions ?? [])
                  .filter((i: any) => !i.is_internal)
                  .map((i: any) => (
                    <div key={i.id} className="border-l-2 border-primary/40 pl-3 mt-2">
                      <p className="text-sm">{i.body}</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
          {(!requests || requests.length === 0) && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                You haven't submitted any requests yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}