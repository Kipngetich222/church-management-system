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

/** A stable key for one occurrence, used to look up hidden dates. */
export function occurrenceKey(serviceId: string, date: string): string {
  return `${serviceId}|${date}`
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
