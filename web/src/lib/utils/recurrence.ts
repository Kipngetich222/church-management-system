import type { RecurringServiceRow, ServiceTime } from '@/lib/constants/services'

export type ServiceOccurrence = {
  serviceId: string
  title: string
  date: string
  times: ServiceTime[]
}

/** Format a date as a local YYYY-MM-DD key. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Shift a `YYYY-MM-DD` key by a number of days, using local-date maths. */
export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** A stable key for one occurrence, used to look up hidden dates. */
export function occurrenceKey(serviceId: string, date: string): string {
  return `${serviceId}|${date}`
}

/**
 * True when `dateKey` falls on the service's weekday and inside its optional
 * start/end window - i.e. it is a genuine occurrence of that service. Used to
 * validate a date a member asked for, so a shared link cannot point the page at
 * an arbitrary day (and therefore at another service's programme).
 */
export function isServiceDate(
  service: RecurringServiceRow,
  dateKey: string
): boolean {
  if (new Date(`${dateKey}T00:00:00`).getDay() !== service.day_of_week) {
    return false
  }
  if (service.start_date && dateKey < service.start_date) return false
  if (service.end_date && dateKey > service.end_date) return false
  return true
}

/**
 * Expand a recurring service into every occurrence between two dates
 * (inclusive). Pure local-date maths, so a service never shifts into the wrong
 * day. Dates present in `hidden` (see `occurrenceKey`) are skipped.
 */
export function expandOccurrences(
  service: RecurringServiceRow,
  fromKey: string,
  toKey: string,
  hidden?: Set<string>
): ServiceOccurrence[] {
  const occurrences: ServiceOccurrence[] = []
  const cursor = new Date(`${fromKey}T00:00:00`)
  const end = new Date(`${toKey}T00:00:00`)
  const lower = service.start_date
    ? new Date(`${service.start_date}T00:00:00`)
    : null
  const upper = service.end_date
    ? new Date(`${service.end_date}T00:00:00`)
    : null

  while (cursor <= end) {
    const key = toDateKey(cursor)
    if (
      cursor.getDay() === service.day_of_week &&
      (!lower || cursor >= lower) &&
      (!upper || cursor <= upper) &&
      !hidden?.has(occurrenceKey(service.id, key))
    ) {
      occurrences.push({
        serviceId: service.id,
        title: service.title,
        date: key,
        times: Array.isArray(service.times) ? service.times : [],
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return occurrences
}

export function expandManyOccurrences(
  services: RecurringServiceRow[],
  fromKey: string,
  toKey: string,
  hidden?: Set<string>
): ServiceOccurrence[] {
  return services
    .filter((service) => service.is_active)
    .flatMap((service) => expandOccurrences(service, fromKey, toKey, hidden))
}

/**
 * The soonest occurrences across a set of services, ordered by date. Used by
 * the member dashboard to surface what is next without opening the calendar.
 */
export function nextOccurrences(
  services: RecurringServiceRow[],
  limit: number,
  fromKey?: string,
  hidden?: Set<string>
): ServiceOccurrence[] {
  const start = fromKey ?? todayKey()
  return expandManyOccurrences(services, start, addDaysToKey(start, 60), hidden)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

/**
 * The next date on or after `fromKey` on which the service occurs and is not
 * hidden.
 */
export function nextOccurrence(
  service: RecurringServiceRow,
  fromKey?: string,
  hidden?: Set<string>
): string {
  const start = fromKey ?? todayKey()
  const cursor = new Date(`${start}T00:00:00`)

  for (let i = 0; i < 400; i += 1) {
    const key = toDateKey(cursor)
    const afterStart = !service.start_date || key >= service.start_date
    const beforeEnd = !service.end_date || key <= service.end_date
    if (
      cursor.getDay() === service.day_of_week &&
      afterStart &&
      beforeEnd &&
      !hidden?.has(occurrenceKey(service.id, key))
    ) {
      return key
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return start
}
