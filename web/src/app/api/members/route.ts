import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  churchId: z.string().uuid(),
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  date_of_birth: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  address: z.string().optional().default(''),
  badges: z.array(z.string()).default([]),
  is_baptized: z.boolean().default(false),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  const input = parsed.data

  // Verify current user is admin of this church
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', input.churchId)
    .single()

  if (!membership || !['super_admin', 'dept_admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Invite user by email
  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name },
    })

  if (inviteErr || !invited.user) {
    return NextResponse.json(
      { error: inviteErr?.message || 'Failed to invite user' },
      { status: 400 }
    )
  }

  // Update profile
  await admin
    .from('users')
    .update({
      full_name: input.full_name,
      phone: input.phone,
    })
    .eq('id', invited.user.id)

  // Create membership
  const { error: memErr } = await admin.from('church_memberships').insert({
    user_id: invited.user.id,
    church_id: input.churchId,
    role: 'member',
    badges: input.badges,
    is_baptized: input.is_baptized,
    date_of_birth: input.date_of_birth || null,
    gender: input.gender || null,
    address: input.address || null,
  })

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 400 })
  }

  // Audit log
  await admin.from('audit_logs').insert({
    church_id: input.churchId,
    actor_id: user.id,
    action: 'member.create',
    entity_type: 'church_membership',
    metadata: { email: input.email },
  })

  return NextResponse.json({ ok: true })
}
