import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, CalendarDays, Crown, Users } from 'lucide-react'
import { JoinGroupButton } from '@/components/small-groups/JoinGroupButton'

export default async function MemberGroupsPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user!.id)
    .eq('church_id', churchId)
    .single()

  const { data: groups } = await supabase
    .from('small_groups')
    .select(`
      *,
      leader:church_memberships!small_groups_leader_membership_id_fkey(users(full_name)),
      small_group_members(id, membership_id)
    `)
    .eq('church_id', churchId)
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Small groups</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {groups?.map((g: any) => {
          const memberIds = (g.small_group_members ?? []).map((m: any) => m.membership_id)
          const isMember = memberIds.includes(membership!.id)
          const count = memberIds.length

          return (
            <Card key={g.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {g.name}
                  <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{g.description ?? 'No description'}</p>
                {g.leader?.users?.full_name && (
                  <div className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Crown className="h-3 w-3" /> Led by {g.leader.users.full_name}
                  </div>
                )}
                {g.meeting_day && (
                  <div className="text-xs flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {g.meeting_day}{g.meeting_time ? ` at ${g.meeting_time}` : ''}
                  </div>
                )}
                {g.location && (
                  <div className="text-xs flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {g.location}
                  </div>
                )}
                <JoinGroupButton
                  groupId={g.id}
                  membershipId={membership!.id}
                  isMember={isMember}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}