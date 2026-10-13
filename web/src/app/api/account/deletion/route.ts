import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getMemberDeletionRequest,
  requestMemberDeletion,
  revertMemberDeletion,
  MEMBER_REVERT_WINDOW_MS,
} from '@/lib/services/deletion.service'

/** Current pending deletion request for the signed-in member (if any). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const request = await getMemberDeletionRequest(user.id)
  return NextResponse.json({ request, windowMs: MEMBER_REVERT_WINDOW_MS })
}

/** Request deletion of the signed-in account (starts the revert window). */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  try {
    const request = await requestMemberDeletion({
      userId: user.id,
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

/** Revert (cancel) the pending deletion request during the window. */
export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reverted = await revertMemberDeletion(user.id)
  return NextResponse.json({ reverted })
}
