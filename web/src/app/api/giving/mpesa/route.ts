import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { stkPush } from '@/lib/services/mpesa.service'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  churchId: z.string().uuid(),
  amount: z.number().positive(),
  phone: z.string().min(9),
  type: z.string().default('general'),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get membership
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('church_id', parsed.data.churchId)
    .single()

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create a pending offering with a unique reference
  const reference = `MPESA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const res = await stkPush({
    phone: parsed.data.phone,
    amount: parsed.data.amount,
    accountReference: reference,
    transactionDesc: 'Church giving',
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/giving/mpesa/callback`,
  })

  // Persist pending record for the callback to reconcile
  await admin.from('offerings').insert({
    church_id: parsed.data.churchId,
    membership_id: membership?.id ?? null,
    amount: parsed.data.amount,
    type: parsed.data.type,
    method: 'mpesa',
    reference,
    notes: 'Awaiting M-Pesa confirmation',
    given_at: new Date().toISOString(),
  })

  return NextResponse.json(res)
}