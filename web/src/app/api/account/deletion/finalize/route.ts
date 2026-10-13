import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { finalizeMemberDeletionIfDue } from '@/lib/services/deletion.service'

/**
 * Apply a due member deletion now. The member profile calls this when its
 * countdown reaches zero so the account is deleted (and the client signed out)
 * at the deadline rather than waiting for the scheduler.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session means the account is already gone.
  if (!user) return NextResponse.json({ finalized: true })

  const finalized = await finalizeMemberDeletionIfDue(user.id)
  return NextResponse.json({ finalized })
}
