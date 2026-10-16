import { createClient } from '@/lib/supabase/server'
import {
  WEEKDAY_LABELS,
  type RecurringServiceRow,
  type ServiceProgrammeRow,
  type ServiceAttendanceRow,
  type ServiceExceptionRow,
  type ServiceTime,
} from '@/lib/constants/services'

export type {
  RecurringServiceRow,
  ServiceProgrammeRow,
  ServiceAttendanceRow,
  ServiceExceptionRow,
  ServiceTime,
}
export { WEEKDAY_LABELS }

export async function listRecurringServices(
  churchId: string
): Promise<RecurringServiceRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_services')
    .select('*')
    .eq('church_id', churchId)
    .order('day_of_week')
    .order('title')
  if (error) throw error
  return (data ?? []) as unknown as RecurringServiceRow[]
}

export async function getRecurringService(
  id: string
): Promise<RecurringServiceRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('recurring_services')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return (data as unknown as RecurringServiceRow) ?? null
}

export async function listProgrammesForRange(
  churchId: string,
  from: string,
  to: string
): Promise<ServiceProgrammeRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('service_programmes')
    .select('*')
    .eq('church_id', churchId)
    .gte('service_date', from)
    .lte('service_date', to)
  return (data ?? []) as unknown as ServiceProgrammeRow[]
}

export async function getProgramme(
  recurringServiceId: string,
  serviceDate: string
): Promise<ServiceProgrammeRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('service_programmes')
    .select('*')
    .eq('recurring_service_id', recurringServiceId)
    .eq('service_date', serviceDate)
    .maybeSingle()
  return (data as unknown as ServiceProgrammeRow) ?? null
}

/** Pull the storage object path out of a legacy public URL. */
function programmePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = '/service-programmes/'
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}

/**
 * A short-lived URL a member or admin can open for a programme. The bucket is
 * private, so files are only reachable through a signed URL that our storage
 * policies hand out to that church's members. Falls back to the stored URL when
 * signing is not possible (e.g. the lock-down migration has not run yet).
 */
export async function getProgrammeFileUrl(
  programme: ServiceProgrammeRow | null | undefined
): Promise<string | null> {
  if (!programme) return null

  const path = programme.file_path ?? programmePathFromUrl(programme.file_url)
  if (!path) return programme.file_url

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('service-programmes')
    .createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return programme.file_url
  return data.signedUrl
}

export async function listServiceAttendance(
  recurringServiceId: string,
  serviceDate: string
): Promise<ServiceAttendanceRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_attendance')
    .select(
      'id, service_date, method, scanned_at, church_memberships(id, users(full_name, email))'
    )
    .eq('recurring_service_id', recurringServiceId)
    .eq('service_date', serviceDate)
    .order('scanned_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ServiceAttendanceRow[]
}

const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01'])

/**
 * True when the error is just "that table isn't deployed yet" rather than a
 * genuine failure. Hiding single days is an optional add-on, so a database that
 * has not had migration 0029 applied yet should not take down the calendars.
 */
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code) && MISSING_TABLE_CODES.has(error!.code!)
}

const MISSING_TABLE_HINT =
  'service_exceptions table is missing. Apply supabase/migrations/0029_service_exceptions.sql to hide single days.'

/** Hidden occurrences for a service, as `YYYY-MM-DD` keys. */
export async function listHiddenDates(
  recurringServiceId: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_exceptions')
    .select('service_date')
    .eq('recurring_service_id', recurringServiceId)
    .order('service_date')
  if (error) {
    if (isMissingTable(error)) {
      console.warn(MISSING_TABLE_HINT)
      return []
    }
    throw error
  }
  return (data ?? []).map((row) => row.service_date)
}

/** Hidden occurrences for a whole church between two dates (inclusive). */
export async function listServiceExceptions(
  churchId: string,
  from: string,
  to: string
): Promise<ServiceExceptionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_exceptions')
    .select('*')
    .eq('church_id', churchId)
    .gte('service_date', from)
    .lte('service_date', to)
  if (error) {
    if (isMissingTable(error)) {
      console.warn(MISSING_TABLE_HINT)
      return []
    }
    throw error
  }
  return (data ?? []) as unknown as ServiceExceptionRow[]
}
