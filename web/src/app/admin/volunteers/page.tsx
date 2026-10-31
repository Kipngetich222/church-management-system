import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requirePermission } from '@/lib/auth/guard'
import { userCan } from '@/lib/auth/permissions'
import {
  listVolunteerActivities,
  listVolunteerParticipants,
} from '@/lib/services/volunteers.service'
import { ActivityBrowser } from '@/components/volunteers/ActivityBrowser'
import { ShiftRoster } from '@/components/volunteers/ShiftRoster'
import { Button } from '@/components/ui/button'

export default async function VolunteersPage() {
  const ctx = await requirePermission('volunteers:read')
  const [activities, signups, canManage] = await Promise.all([
    listVolunteerActivities(ctx.churchId),
    listVolunteerParticipants(ctx.churchId),
    userCan(ctx.churchId, ctx.role, 'volunteers:*'),
  ])
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Volunteers</h1>
          <p className="mt-1 text-muted-foreground">
            Organise activities and see everyone who has chosen to participate.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/admin/volunteers/new">
              <Plus className="mr-2 size-4" />
              New activity
            </Link>
          </Button>
        )}
      </div>
      <ActivityBrowser activities={activities} admin canManage={canManage} />
      <ShiftRoster signups={signups} showActivity canManage={canManage} />
    </div>
  )
}
