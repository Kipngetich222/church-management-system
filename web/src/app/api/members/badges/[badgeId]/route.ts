import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  deleteMemberBadge,
  updateMemberBadge,
} from '@/lib/services/members.service'

const bodySchema = z.object({
  churchId: z.string().uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(240).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
})

async function getAdminMembership(churchId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .maybeSingle()

  if (!membership || !['super_admin', 'dept_admin'].includes(membership.role)) {
    return { error: 'Forbidden', status: 403 as const }
  }

  return { user, role: membership.role }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const { badgeId } = await params

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

  const auth = await getAdminMembership(parsed.data.churchId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const badge = await updateMemberBadge({
      churchId: parsed.data.churchId,
      actorId: auth.user.id,
      badgeId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      icon: parsed.data.icon,
    })
    return NextResponse.json({ badge })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const { badgeId } = await params
  const churchId = new URL(req.url).searchParams.get('churchId')
  if (!churchId) {
    return NextResponse.json({ error: 'Missing churchId' }, { status: 400 })
  }

  const auth = await getAdminMembership(churchId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    await deleteMemberBadge({
      churchId,
      actorId: auth.user.id,
      badgeId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
