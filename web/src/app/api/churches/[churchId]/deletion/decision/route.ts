import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { decideChurchDeletion } from '@/lib/services/deletion.service'

type AuthResult = { user: User } | { response: NextResponse }

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

/** A super admin accepts or rejects an in-progress church deletion. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  const { churchId } = await params
  const auth = await requireSuperAdmin(churchId)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({}))
  const decision = body?.decision
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json(
      { error: 'decision must be approve or reject' },
      { status: 400 }
    )
  }

  try {
    const request = await decideChurchDeletion({
      churchId,
      actorId: auth.user.id,
      decision,
    })
    return NextResponse.json({ request })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
