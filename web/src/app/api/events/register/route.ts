import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const schema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  const { eventId, name, email, phone } = parsed.data

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch event
  const { data: event } = await admin
    .from('events')
    .select('id, price, capacity, is_registration_required, status, registration_deadline')
    .eq('id', eventId)
    .single()

  if (!event || event.status !== 'published') {
    return NextResponse.json({ error: 'Event not available' }, { status: 404 })
  }

  // Deadline check
  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return NextResponse.json({ error: 'Registration is closed' }, { status: 400 })
  }

  // Capacity check
  if (event.capacity != null) {
    const { count } = await admin
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['registered', 'checked_in'])
    if ((count ?? 0) >= event.capacity) {
      return NextResponse.json({ error: 'Event is full' }, { status: 400 })
    }
  }

  // Link to a logged-in user if possible
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ticket_code = randomBytes(8).toString('hex')
  const isPaid = (event.price ?? 0) > 0

  const { data: reg, error } = await admin
    .from('event_registrations')
    .insert({
      event_id: eventId,
      user_id: user?.id ?? null,
      guest_name: user ? null : name,
      guest_email: user ? null : email,
      guest_phone: user ? null : phone,
      payment_status: isPaid ? 'pending' : 'free',
      amount_paid: isPaid ? null : 0,
      ticket_code,
    })
    .select('id, ticket_code')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If free, mark as checked-in-eligible immediately
  if (!isPaid) return NextResponse.json({ ticket_code: reg.ticket_code })

  // Placeholder: integrate M-Pesa here in Phase 4
  // For now, return checkout_url: null so the UI shows the ticket.
  return NextResponse.json({ ticket_code: reg.ticket_code, checkout_url: null })
}