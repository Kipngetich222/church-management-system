import { formatInTimeZone } from 'date-fns-tz'
import type { Database } from '@/types/database'

export type VolunteerActivity =
  Database['public']['Functions']['get_volunteer_activities']['Returns'][number]
export type VolunteerShift =
  Database['public']['Tables']['volunteer_shifts']['Row']
export const VOLUNTEER_CATEGORIES = {
  cleaning: 'Church cleaning',
  compound: 'Compound cleaning',
  gardening: 'Fences, flowers & gardening',
  community: 'Community work',
  other: 'Other service',
} as const
export const VOLUNTEER_RECURRENCE = {
  none: 'One-time activity',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
} as const

export function activitySchedule(
  activity: Pick<
    VolunteerActivity,
    'starts_at' | 'ends_at' | 'next_starts_at' | 'next_ends_at' | 'timezone'
  >
) {
  const start = activity.next_starts_at ?? activity.starts_at
  const end = activity.next_ends_at ?? activity.ends_at
  const zone = activity.timezone
  const sameDay =
    formatInTimeZone(start, zone, 'yyyy-MM-dd') ===
    formatInTimeZone(end, zone, 'yyyy-MM-dd')
  return `${formatInTimeZone(start, zone, 'EEE, d MMM yyyy · h:mm a')} – ${formatInTimeZone(end, zone, sameDay ? 'h:mm a' : 'EEE, d MMM yyyy · h:mm a')} (${zone.replaceAll('_', ' ')})`
}

export function recurrenceDescription(
  activity: Pick<
    VolunteerActivity,
    'starts_at' | 'recurrence' | 'recurrence_until' | 'timezone'
  >
) {
  let label: string =
    VOLUNTEER_RECURRENCE[
      activity.recurrence as keyof typeof VOLUNTEER_RECURRENCE
    ] ?? 'One-time activity'
  if (activity.recurrence === 'weekly')
    label += ` on ${formatInTimeZone(activity.starts_at, activity.timezone, 'EEEE')}`
  if (activity.recurrence === 'monthly')
    label += ` on day ${formatInTimeZone(activity.starts_at, activity.timezone, 'd')} (last day in shorter months)`
  if (activity.recurrence !== 'none')
    label += activity.recurrence_until
      ? ` · Until ${activity.recurrence_until}`
      : ' · Ongoing'
  return label
}

export function volunteerError(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '23505'
  )
    return 'You have already signed up. Refresh the page to see your participation.'
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message
  return 'Unable to save your changes. Please try again.'
}
