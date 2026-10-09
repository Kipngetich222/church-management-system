import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dashboardPathForRole } from '@/lib/auth/redirect'

const bodySchema = z
  .object({
    churchId: z.string().uuid().optional(),
    slug: z.string().trim().min(1).max(120).optional(),
  })
  .refine((value) => Boolean(value.churchId || value.slug), {
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
        .select('id, name, slug')
        .eq('id', parsed.data.churchId)
        .maybeSingle()
    : await admin
        .from('churches')
        .select('id, name, slug')
        .eq('slug', parsed.data.slug!)
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
