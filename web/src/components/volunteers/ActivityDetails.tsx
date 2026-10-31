import { CalendarDays, MapPin, Repeat } from 'lucide-react'
import {
  activitySchedule,
  recurrenceDescription,
  type VolunteerActivity,
} from '@/lib/volunteers'

export function ActivityDetails({ activity }: { activity: VolunteerActivity }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-start gap-2">
        <Repeat className="mt-0.5 size-4 shrink-0" />
        <span>{recurrenceDescription(activity)}</span>
      </p>
      <p className="flex items-start gap-2">
        <CalendarDays className="mt-0.5 size-4 shrink-0" />
        <span>
          {activity.recurrence !== 'none'
            ? activity.next_starts_at
              ? 'Next session: '
              : 'First session: '
            : ''}
          {activitySchedule(activity)}
        </span>
      </p>
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0" />
        <span>{activity.location || 'Venue to be confirmed'}</span>
      </p>
      {activity.notes && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {activity.notes}
        </p>
      )}
    </div>
  )
}
