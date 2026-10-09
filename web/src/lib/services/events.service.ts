import { createClient } from '@/lib/supabase/server'

export type EventRow = {
  id: string
  church_id: string
  title: string
  slug: string
  description: string | null
  start_time: string
  end_time: string | null
  all_day: boolean
  location_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  poster_url: string | null
  capacity: number | null
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  visibility: 'public' | 'members_only'
  is_registration_required: boolean
  registration_deadline: string | null
  price: number | null
  currency: string
  qr_code: string | null
  created_at: string
}

export async function listEvents(churchId: string, opts?: {
  from?: string
  to?: string
  status?: string
}): Promise<EventRow[]> {
  const supabase = await createClient()
  let q = supabase
    .from('events')
    .select('*')
    .eq('church_id', churchId)
    .order('start_time', { ascending: true })

  if (opts?.from) q = q.gte('start_time', opts.from)
  if (opts?.to) q = q.lte('start_time', opts.to)
  if (opts?.status)
    q = q.eq('status', opts.status as 'draft' | 'published' | 'cancelled' | 'completed')

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as EventRow[]
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('*').eq('id', id).single()
  return (data as EventRow) ?? null
}

export async function getEventBySlug(churchSlug: string, eventSlug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*, churches!inner(name, slug, logo_url)')
    .eq('slug', eventSlug)
    .eq('churches.slug', churchSlug)
    .single()
  return data
}

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
  return (data ?? []) as EventRow[]
}
