import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dashboardPathForRole } from '@/lib/auth/redirect'
import { STARTER_MEMBER_LIMIT } from '@/lib/constants/plans'
import {
  getPlanUsage,
  isMemberLimitError,
  notifyMemberLimitReached,
} from '@/lib/services/plan.service'

const bodySchema = z
  .object({
    churchId: z.string().uuid().optional(),
    username: z.string().trim().min(1).max(120).optional(),
  })
  .refine((value) => Boolean(value.churchId || value.username), {
    message: 'Pick a church to join.',
  })

/**
 * Join an existing church as a member.
 *
 * Idempotent: if the user is already a member we resolve their existing role and
 * return the right dashboard instead of surfacing a confusing "already part of
 * this church" error while leaving them stuck on the onboarding page.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Your session has expired. Please sign in again.' },
      { status: 401 }
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Pick a church to join.',
      },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data: church, error: findError } = parsed.data.churchId
    ? await admin
        .from('churches')
        .select('id, name, username')
        .eq('id', parsed.data.churchId)
        .maybeSingle()
    : await admin
        .from('churches')
        .select('id, name, username')
        .eq('username', parsed.data.username!)
        .maybeSingle()

  if (findError) {
    console.error('Failed to look up church:', findError)
    return NextResponse.json(
      {
        error: 'We could not look that church up right now. Please try again.',
      },
      { status: 500 }
    )
  }

  if (!church) {
    return NextResponse.json(
      { error: 'No church found with that link. Check it and try again.' },
      { status: 404 }
    )
  }

  const { data: existing } = await admin
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', church.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      church,
      role: existing.role,
      alreadyMember: true,
      path: dashboardPathForRole(existing.role),
    })
  }

  if (user.email) {
    await admin
      .from('users')
      .upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
  }

  // Starter churches hold at most 200 member seats. When a church is full
  // nobody new can join until it is upgraded to the Growth plan - so explain
  // that clearly and let its admins know someone tried to join.
  const usage = await getPlanUsage(church.id)
  if (usage.atLimit && usage.memberLimit !== null) {
    await notifyMemberLimitReached({
      churchId: church.id,
      churchName: church.name,
      memberLimit: usage.memberLimit,
      attemptedEmail: user.email ?? null,
    })
    return NextResponse.json(
      {
        code: 'member_limit_reached',
        error:
          `${church.name} is currently full. It is on the Starter plan, which ` +
          `supports up to ${usage.memberLimit} members, so no new members can ` +
          `join until the church upgrades to the Growth plan.`,
      },
      { status: 409 }
    )
  }

  const { error: insertError } = await admin
    .from('church_memberships')
    .insert({ user_id: user.id, church_id: church.id, role: 'member' })

  if (insertError) {
    // A unique-violation means another request joined first: treat as success.
    if (insertError.code === '23505') {
      const { data: raced } = await admin
        .from('church_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('church_id', church.id)
        .maybeSingle()
      const role = raced?.role ?? 'member'
      return NextResponse.json({
        church,
        role,
        alreadyMember: true,
        path: dashboardPathForRole(role),
      })
    }
    // Raced past the check above and hit the database cap: calm, same message.
    if (isMemberLimitError(insertError)) {
      await notifyMemberLimitReached({
        churchId: church.id,
        churchName: church.name,
        memberLimit: usage.memberLimit ?? STARTER_MEMBER_LIMIT,
        attemptedEmail: user.email ?? null,
      })
      return NextResponse.json(
        {
          code: 'member_limit_reached',
          error:
            `${church.name} is currently full and cannot accept new members ` +
            `until it upgrades to the Growth plan.`,
        },
        { status: 409 }
      )
    }
    console.error('Failed to join church:', insertError)
    return NextResponse.json(
      { error: 'We could not join this church right now. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    church,
    role: 'member',
    alreadyMember: false,
    path: '/member/home',
  })
}
