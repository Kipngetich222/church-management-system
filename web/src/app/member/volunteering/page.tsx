import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { listVolunteerActivities } from '@/lib/services/volunteers.service'
import { ActivityBrowser } from '@/components/volunteers/ActivityBrowser'

export default async function VolunteeringPage() {
  const { churchId, user } = await getActiveChurch()
  const supabase = await createClient()
  const { data: membership, error } = await supabase
    .from('church_memberships')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .single()
  if (error || !membership)
    throw new Error('Unable to load your church membership. Please try again.')
  if ((membership.status ?? 'active') !== 'active')
    return (
      <p>
        Your church membership must be active to participate in volunteer
        activities. Please contact your church administrator.
      </p>
    )
  const activities = await listVolunteerActivities(churchId)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Volunteer opportunities</h1>
        <p className="mt-1 text-muted-foreground">
          Choose how you would like to help with church cleaning, gardening,
          community work and more.
        </p>
      </div>
      <ActivityBrowser activities={activities} membershipId={membership.id} />
    </div>
  )
}
