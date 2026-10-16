import { createClient } from '@/lib/supabase/server'
import {
  WEEKDAY_LABELS,
  type RecurringServiceRow,
  type ServiceProgrammeRow,
  type ServiceAttendanceRow,
  type ServiceTime,
} from '@/lib/constants/services'

export type {
  RecurringServiceRow,
  ServiceProgrammeRow,
  ServiceAttendanceRow,
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
