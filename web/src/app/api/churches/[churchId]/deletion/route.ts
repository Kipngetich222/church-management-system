import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  getChurchDeletionStatus,
  initiateChurchDeletion,
  revertChurchDeletion,
  CHURCH_REVERT_WINDOW_MS,
} from '@/lib/services/deletion.service'

type AuthResult = { user: User } | { response: NextResponse }

/** Only a super admin of the church may read / drive its deletion. */
async function requireSuperAdmin(churchId: string): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .maybeSingle()

  if (!membership || membership.role !== 'super_admin') {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user }
}

/** Current church deletion request + every super admin's decision. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  const { churchId } = await params
  const auth = await requireSuperAdmin(churchId)
  if ('response' in auth) return auth.response

  const status = await getChurchDeletionStatus(churchId)
  return NextResponse.json({ status, windowMs: CHURCH_REVERT_WINDOW_MS })
}

/** Start the deletion process; every super admin must then accept it. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  const { churchId } = await params
  const auth = await requireSuperAdmin(churchId)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({}))
  try {
    const request = await initiateChurchDeletion({
      churchId,
      actorId: auth.user.id,
      reason: body?.reason,
    })
    return NextResponse.json({ request })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}

/** Revert a pending / approved deletion during the grace period. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  const { churchId } = await params
  const auth = await requireSuperAdmin(churchId)
  if ('response' in auth) return auth.response

  const reverted = await revertChurchDeletion({
    churchId,
    actorId: auth.user.id,
  })
  return NextResponse.json({ reverted })
}
