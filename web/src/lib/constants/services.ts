import type { EventVisibility } from '@/lib/constants/events'

/**
 * Client-safe types and constants for recurring services.
 *
 * These live here (not in the data-access module) so components that must run in
 * the browser can import them without pulling in the server-only Supabase
 * client, which depends on `next/headers`.
 */

export type ServiceTime = {
  label: string
  start: string
  end?: string | null
}

export type RecurringServiceRow = {
  id: string
  church_id: string
  title: string
  description: string | null
  procedure: string | null
  day_of_week: number
  times: ServiceTime[]
  location_name: string | null
  address: string | null
  timezone: string
  visibility: EventVisibility
  is_active: boolean
  start_date: string | null
  end_date: string | null
  qr_code: string | null
  created_at: string
}

export type ServiceProgrammeRow = {
  id: string
  church_id: string
  recurring_service_id: string
  service_date: string
  title: string | null
  notes: string | null
  file_url: string | null
  file_name: string | null
}

export type ServiceAttendanceRow = {
  id: string
  service_date: string
  method: string | null
  scanned_at: string | null
  church_memberships: {
    id: string
    users: { full_name: string | null; email: string | null } | null
  } | null
}

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
