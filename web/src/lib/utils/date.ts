import { format, formatDistanceToNow, isSameDay, isToday, isTomorrow } from 'date-fns'

export function formatEventDate(start: string, end?: string | null, allDay = false) {
  const s = new Date(start)
  const e = end ? new Date(end) : null

  if (allDay) {
    return e && !isSameDay(s, e)
      ? `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
      : format(s, 'EEEE, MMM d, yyyy')
  }

  if (e && isSameDay(s, e)) {
    return `${format(s, 'EEE, MMM d')} · ${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`
  }
  if (e) {
    return `${format(s, 'MMM d, h:mm a')} – ${format(e, 'MMM d, h:mm a')}`
  }
  return format(s, 'EEEE, MMM d, yyyy · h:mm a')
}

export function relativeEventTime(start: string): string {
  const d = new Date(start)
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow · ${format(d, 'h:mm a')}`
  return formatDistanceToNow(d, { addSuffix: true })
}

export function isUpcoming(start: string): boolean {
  return new Date(start) > new Date()
}