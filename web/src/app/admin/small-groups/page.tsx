import { getActiveChurch } from '@/lib/utils/church-scope'
import { listSmallGroups } from '@/lib/services/small-groups.service'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Users, MapPin, CalendarDays } from 'lucide-react'

export default async function SmallGroupsPage() {
  const { churchId } = await getActiveChurch()
  const groups = await listSmallGroups(churchId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Small Groups</h1>
          <p className="text-sm text-muted-foreground">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button render={<Link href="/admin/small-groups/new" />}>
          <Plus className="h-4 w-4 mr-2" /> New group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No small groups yet. Create one to start building community.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const memberCount = g.small_group_members?.length ?? 0
            const leaderName = g.leader?.users?.full_name ?? 'No leader'
            return (
              <Card key={g.id} className="hover:shadow-md transition">
                <Link href={`/admin/small-groups/${g.id}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {g.name}
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {memberCount}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {g.description || 'No description'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Led by <strong>{leaderName}</strong>
                    </p>
                    {(g.meeting_day || g.meeting_time) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {[g.meeting_day, g.meeting_time]
                          .filter(Boolean)
                          .join(' at ')}
                      </div>
                    )}
                    {g.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {g.location}
                      </div>
                    )}
                  </CardContent>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
