import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import type {
  EventStatus,
  EventVisibility,
  EventType,
  PaymentMethod,
} from '@/lib/constants/events'

export type { EventStatus, EventVisibility, EventType, PaymentMethod }

export type EventRow = {
  id: string
  church_id: string
  title: string
  slug: string
  description: string | null
  start_time: string
  end_time: string | null
  all_day: boolean
  event_type: EventType
  meeting_link: string | null
  meeting_platform: string | null
  location_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  poster_url: string | null
  capacity: number | null
  status: EventStatus
  visibility: EventVisibility
  visibility_department_id: string | null
  visibility_group_id: string | null
  is_registration_required: boolean
  registration_deadline: string | null
  price: number | null
  currency: string
  payment_method: PaymentMethod | null
  payment_number: string | null
  payment_account: string | null
  payment_instructions: string | null
  qr_code: string | null
  created_at: string
}

export type EventStats = {
  booked: number
  paid: number
  confirmed: number
  attendance: number
  revenue: number
}

export async function listEvents(
  churchId: string,
  opts?: {
    from?: string
    to?: string
    status?: string
  }
): Promise<EventRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from('events')
    .select('*')
    .eq('church_id', churchId)
    .order('start_time', { ascending: true })

  if (opts?.from) q = q.gte('start_time', opts.from)
  if (opts?.to) q = q.lte('start_time', opts.to)
  if (opts?.status) q = q.eq('status', opts.status as EventStatus)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as EventRow[]
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  return (data as unknown as EventRow) ?? null
}

export async function getEventBySlug(
  churchUsername: string,
  eventSlug: string
) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*, churches!inner(name, username, logo_url)')
    .eq('slug', eventSlug)
    .eq('churches.username', churchUsername)
    .single()
  return data
}

/**
 * Upcoming events a viewer can see: published events that have not started yet.
 * Completed and cancelled events are intentionally excluded so they drop off
 * the "upcoming" list the moment their status changes.
 */
export async function listUpcomingEvents(
  churchId: string,
  limit = 20
): Promise<EventRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('church_id', churchId)
    .eq('status', 'published')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as EventRow[]
}

/**
 * Past events: anything already held, plus events explicitly marked completed.
 */
export async function listPastEvents(
  churchId: string,
  limit = 20
): Promise<EventRow[]> {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('church_id', churchId)
    .in('status', ['published', 'completed', 'cancelled'])
    .or(`status.eq.completed,start_time.lt.${nowIso}`)
    .order('start_time', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as EventRow[]
}

/**
 * Public marketing helper: upcoming public events for one church.
 */
export async function getUpcomingPublicEvents(churchId: string, limit = 5) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('church_id', churchId)
    .eq('visibility', 'public')
    .eq('status', 'published')
    .gte('start_time', new Date().toISOString())
    .order('start_time')
    .limit(limit)
  return (data ?? []) as unknown as EventRow[]
}

/**
 * Load an event for a shared link or a scanned QR code. Uses the service role
 * so anyone holding the link can view the details (and act on them, e.g. buy a
 * ticket) even when the event is not public. Drafts are never exposed.
 */
export type EventForLink = EventRow & {
  churches: {
    id: string
    name: string
    username: string
    logo_url: string | null
  } | null
}

export async function getEventForLink(
  eventId: string
): Promise<EventForLink | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('events')
    .select('*, churches(id, name, username, logo_url)')
    .eq('id', eventId)
    .neq('status', 'draft')
    .maybeSingle()
  return (data as unknown as EventForLink) ?? null
}

export async function getEventEngagement(eventId: string): Promise<EventStats> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('event_engagement', {
    p_event_id: eventId,
  })
  const row = (data ?? [])[0]
  return {
    booked: Number(row?.booked ?? 0),
    paid: Number(row?.paid ?? 0),
    confirmed: Number(row?.confirmed ?? 0),
    attendance: Number(row?.attendance ?? 0),
    revenue: Number(row?.revenue ?? 0),
  }
}

/**
 * Booking / attendance totals for every event in a church, keyed by event id.
 * Used to show "booked" and "attending" numbers on the admin dashboards.
 */
export async function getChurchEventStats(
  churchId: string
): Promise<Record<string, EventStats>> {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .eq('church_id', churchId)

  const ids = (events ?? []).map((e) => e.id)
  const stats: Record<string, EventStats> = {}
  if (ids.length === 0) return stats

  const [{ data: registrations }, { data: attendance }] = await Promise.all([
    supabase
      .from('event_registrations')
      .select('event_id, status, payment_status, amount_paid')
      .in('event_id', ids),
    supabase.from('event_attendance').select('event_id').in('event_id', ids),
  ])

  for (const id of ids) {
    stats[id] = { booked: 0, paid: 0, confirmed: 0, attendance: 0, revenue: 0 }
  }

  for (const r of registrations ?? []) {
    const s = stats[r.event_id]
    if (!s) continue
    if (r.status === 'registered' || r.status === 'checked_in') s.booked += 1
    if (r.status === 'checked_in') s.confirmed += 1
    if (r.payment_status === 'paid') {
      s.paid += 1
      s.revenue += Number(r.amount_paid ?? 0)
    }
  }

  for (const a of attendance ?? []) {
    const s = stats[a.event_id]
    if (s) s.attendance += 1
  }

  return stats
}

export type EventRegistrationPerson = {
  full_name: string | null
  email: string | null
}

export type EventRegistrationRow = {
  id: string
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  status: string | null
  payment_status: string | null
  amount_paid: number | null
  ticket_code: string | null
  created_at: string | null
  church_memberships: {
    id: string
    users: EventRegistrationPerson | null
  } | null
}

export type EventAttendanceRow = {
  id: string
  scanned_at: string | null
  method: string | null
  church_memberships: {
    id: string
    users: EventRegistrationPerson | null
  } | null
}

/** Everyone who booked / registered for an event (admin view). */
export async function listEventRegistrations(
  eventId: string
): Promise<EventRegistrationRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_registrations')
    .select(
      `id, guest_name, guest_email, guest_phone, status, payment_status,
       amount_paid, ticket_code, created_at,
       church_memberships(id, users(full_name, email))`
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EventRegistrationRow[]
}

/** Everyone who has checked in / confirmed attendance for an event. */
export async function listEventAttendanceForEvent(
  eventId: string
): Promise<EventAttendanceRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('event_attendance')
    .select(
      `id, scanned_at, method,
       church_memberships(id, users(full_name, email))`
    )
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EventAttendanceRow[]
}
