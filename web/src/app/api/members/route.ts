import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getPlanUsage, isMemberLimitError } from '@/lib/services/plan.service'
import {
  isValidPhone,
  normalizePhone,
  PHONE_VALIDATION_MESSAGE,
} from '@/lib/phone'

const bodySchema = z.object({
  churchId: z.string().uuid(),
  mode: z.enum(['invite', 'manual']).optional(),
  full_name: z.string().trim().min(1).max(160),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default('')
    .refine(
      (value) => value === '' || z.string().email().safeParse(value).success,
      { message: 'Enter a valid email address.' }
    ),
  phone: z
    .string()
    .optional()
    .default('')
    .refine((value) => value === '' || isValidPhone(value), {
      message: PHONE_VALIDATION_MESSAGE,
    }),
  date_of_birth: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  category: z.enum(['men', 'women', 'youth', 'children']).nullish(),
  address: z.string().optional().default(''),
  badges: z.array(z.string()).default([]),
  is_baptized: z.boolean().default(false),
})

function migrationMessage(error: { code?: string; message?: string } | null) {
  if (!error) return null
  const missing =
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    Boolean(error.message && /column .* does not exist/i.test(error.message))
  return missing
    ? 'The member upgrade migration is not applied yet. Run the pending Supabase migrations and try again.'
    : null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }
  const input = parsed.data
  const mode = input.mode ?? (input.email ? 'invite' : 'manual')

  // Verify the current user is an admin of this church.
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', input.churchId)
    .maybeSingle()

  if (!membership || !['super_admin', 'dept_admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const isSuperAdmin = membership.role === 'super_admin'

  if (mode === 'invite' && !input.email) {
    return NextResponse.json(
      { error: 'An email address is required when inviting an account.' },
      { status: 400 }
    )
  }

  if (mode === 'manual') {
    if (input.category !== 'children' && !input.phone) {
      return NextResponse.json(
        {
          error:
            'A phone number is required for adults and youth without an account so the church can reach them by SMS.',
        },
        { status: 400 }
      )
    }
  }

  // Respect the church's plan cap before adding anyone.
  const usage = await getPlanUsage(input.churchId)
  if (usage.atLimit && usage.memberLimit !== null) {
    return NextResponse.json(
      {
        code: 'member_limit_reached',
        error:
          `Your church has reached its ${usage.memberLimit}-member limit on the ` +
          `${usage.planName} plan. Upgrade in Plan and Billing to add more members.`,
      },
      { status: 409 }
    )
  }

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const badges = input.badges
    .map((badge) => badge.trim())
    .filter(Boolean)
    .slice(0, 20)
  const normalizedPhone = input.phone ? normalizePhone(input.phone) : null

  if (mode === 'manual') {
    const { data: created, error } = await admin
      .from('church_memberships')
      .insert({
        user_id: null,
        church_id: input.churchId,
        role: 'member',
        full_name: input.full_name,
        email: input.email || null,
        phone: normalizedPhone,
        date_of_birth: input.date_of_birth || null,
        gender: input.gender || null,
        category: (input.category ?? null) as never,
        address: input.address || null,
        badges: badges as never,
        is_baptized: isSuperAdmin ? input.is_baptized : false,
        is_manual: true,
        created_by: user.id,
        status: 'active',
      } as never)
      .select('id')
      .single()

    if (error) {
      const migrationError = migrationMessage(error)
      if (migrationError) {
        return NextResponse.json({ error: migrationError }, { status: 409 })
      }
      if (isMemberLimitError(error)) {
        return NextResponse.json(
          {
            code: 'member_limit_reached',
            error:
              'Your church has reached the member limit of its current plan. Upgrade to add more members.',
          },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await admin.from('audit_logs').insert({
      church_id: input.churchId,
      actor_id: user.id,
      action: 'member.manual_create',
      entity_type: 'church_membership',
      entity_id: created.id,
      metadata: {
        name: input.full_name,
        phone: normalizedPhone,
        category: input.category ?? null,
      },
    })

    revalidatePath('/admin/members')
    revalidatePath('/admin/members/badges')

    return NextResponse.json({ ok: true, id: created.id, mode })
  }

  // Invite flow. Reuse an existing account when the email is already known.
  let userId: string | null = null
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .ilike('email', input.email)
    .maybeSingle()

  if (existingUser) {
    userId = existingUser.id
    const { data: existingMembership } = await admin
      .from('church_memberships')
      .select('id')
      .eq('user_id', existingUser.id)
      .eq('church_id', input.churchId)
      .maybeSingle()

    if (existingMembership) {
      return NextResponse.json(
        { error: 'That person is already a member of this church.' },
        { status: 409 }
      )
    }
  } else {
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(input.email, {
        data: { full_name: input.full_name },
      })

    if (inviteError || !invited.user) {
      return NextResponse.json(
        { error: inviteError?.message || 'Failed to invite user' },
        { status: 400 }
      )
    }
    userId = invited.user.id
  }

  await admin
    .from('users')
    .update({
      full_name: input.full_name,
      phone: normalizedPhone,
      date_of_birth: input.date_of_birth || null,
      gender: input.gender || null,
      category: (input.category ?? null) as never,
    } as never)
    .eq('id', userId!)

  const { data: created, error: memError } = await admin
    .from('church_memberships')
    .insert({
      user_id: userId!,
      church_id: input.churchId,
      role: 'member',
      full_name: input.full_name,
      email: input.email,
      phone: normalizedPhone,
      date_of_birth: input.date_of_birth || null,
      gender: input.gender || null,
      category: (input.category ?? null) as never,
      address: input.address || null,
      badges: badges as never,
      is_baptized: isSuperAdmin ? input.is_baptized : false,
      is_manual: false,
      created_by: user.id,
      status: 'active',
    } as never)
    .select('id')
    .single()

  if (memError) {
    const migrationError = migrationMessage(memError)
    if (migrationError) {
      return NextResponse.json({ error: migrationError }, { status: 409 })
    }
    if (isMemberLimitError(memError)) {
      return NextResponse.json(
        {
          code: 'member_limit_reached',
          error:
            'Your church has reached the member limit of its current plan. Upgrade to add more members.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: memError.message }, { status: 400 })
  }

  await admin.from('audit_logs').insert({
    church_id: input.churchId,
    actor_id: user.id,
    action: 'member.create',
    entity_type: 'church_membership',
    entity_id: created.id,
    metadata: { email: input.email },
  })

  revalidatePath('/admin/members')
  revalidatePath('/admin/members/badges')

  return NextResponse.json({ ok: true, id: created.id, mode })
}
