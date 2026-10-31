import { createClient } from '@/lib/supabase/server'
import type { VolunteerActivity } from '@/lib/volunteers'

export async function listVolunteerActivities(
  churchId: string
): Promise<VolunteerActivity[]> {
  const supabase = await createClient()
  const activities: VolunteerActivity[] = []
  // Read every page; churches may create any number of activities.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase
      .rpc('get_volunteer_activities', { p_church_id: churchId })
      .order('id')
      .range(offset, offset + 99)
    if (error)
      throw new Error('Unable to load volunteer activities. Please try again.')
    activities.push(...(data ?? []))
    if (!data || data.length < 100) break
  }
  return activities.sort((a, b) => {
    const aOpen = a.is_active && a.next_starts_at !== null
    const bOpen = b.is_active && b.next_starts_at !== null
    return (
      Number(bOpen) - Number(aOpen) ||
      (a.next_starts_at ?? a.starts_at).localeCompare(
        b.next_starts_at ?? b.starts_at
      )
    )
  })
}

export async function listVolunteerParticipants(
  churchId: string,
  shiftId?: string
) {
  const supabase = await createClient()
  const query = () => {
    let request = supabase
      .from('volunteer_signups')
      .select(
        `
      id, shift_id, status, signed_up_at, membership_id,
      volunteer_shifts!inner(church_id, title),
      church_memberships(full_name, email, phone, users!church_memberships_user_id_fkey(full_name, email, phone))
    `
      )
      .eq('volunteer_shifts.church_id', churchId)
      .order('signed_up_at')
      .order('id')
    if (shiftId) request = request.eq('shift_id', shiftId)
    return request
  }
  const first = await query().range(0, 99)
  if (first.error)
    throw new Error('Unable to load participants. Please try again.')
  const participants = first.data ?? []
  if (participants.length === 100) {
    for (let offset = 100; ; offset += 100) {
      const { data, error } = await query().range(offset, offset + 99)
      if (error)
        throw new Error('Unable to load participants. Please try again.')
      participants.push(...(data ?? []))
      if (!data || data.length < 100) break
    }
  }
  return participants
}

export type VolunteerParticipant = Awaited<
  ReturnType<typeof listVolunteerParticipants>
>[number]

export async function volunteerFormOptions(churchId: string) {
  const supabase = await createClient()
  const [roles, events] = await Promise.all([
    supabase
      .from('volunteer_roles')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name'),
    supabase
      .from('events')
      .select('id, title')
      .eq('church_id', churchId)
      .order('start_time', { ascending: false }),
  ])
  if (roles.error || events.error)
    throw new Error('Unable to load activity options. Please try again.')
  return { roles: roles.data ?? [], events: events.data ?? [] }
}
