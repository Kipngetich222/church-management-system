import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { listVolunteerActivities } from '@/lib/services/volunteers.service'
import { userCan } from '@/lib/auth/permissions'
import { activitySchedule, type VolunteerActivity } from '@/lib/volunteers'

export async function VolunteerOverview({
  churchId,
  adminRole,
}: {
  churchId: string
  adminRole?: string
}) {
  if (adminRole && !(await userCan(churchId, adminRole, 'volunteers:read')))
    return null
  const href = adminRole ? '/admin/volunteers' : '/member/volunteering'
  let activities: VolunteerActivity[]
  try {
    activities = await listVolunteerActivities(churchId)
  } catch {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm">Volunteer activities could not be loaded.</p>
          <Link className="text-sm underline" href={href}>
            Open volunteering to try again
          </Link>
        </CardContent>
      </Card>
    )
  }
  const open = activities.filter(
    (activity) => activity.is_active && activity.next_starts_at
  )
  const mine = open.filter(
    (activity) =>
      activity.my_status === 'confirmed' || activity.my_status === 'waitlist'
  )
  const preview = (
    adminRole
      ? open
      : [...mine, ...open.filter((activity) => !mine.includes(activity))]
  ).slice(0, 3)
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {adminRole ? 'Volunteers' : 'Serve in your church'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {open.length} open {open.length === 1 ? 'activity' : 'activities'} ·{' '}
          {adminRole
            ? `${open.reduce((sum, activity) => sum + activity.participant_count, 0)} sign-ups`
            : `You have joined ${mine.length}`}
        </p>
        {preview.map((activity) => (
          <div key={activity.id} className="space-y-1 rounded-md border p-3">
            <Link
              className="font-medium hover:underline"
              href={
                adminRole
                  ? `${href}/${activity.id}`
                  : `${href}#activity-${activity.id}`
              }
            >
              {activity.title}
            </Link>
            {!adminRole && activity.my_status === 'confirmed' && (
              <p className="text-xs text-primary">You are participating</p>
            )}
            <p className="text-xs text-muted-foreground">
              {activitySchedule(activity)}
            </p>
            <p className="text-xs text-muted-foreground">
              {activity.location || 'Venue to be confirmed'}
              {activity.recurrence !== 'none'
                ? ` · Repeats ${activity.recurrence}`
                : ' · One-time'}
            </p>
          </div>
        ))}
        {open.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {adminRole
              ? 'Create an activity to invite members to help.'
              : 'New opportunities will appear here when your church posts them.'}
          </p>
        )}
        <Button variant="outline" asChild>
          <Link href={href}>
            {adminRole
              ? 'Manage activities & participants'
              : 'View activities & my participation'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
