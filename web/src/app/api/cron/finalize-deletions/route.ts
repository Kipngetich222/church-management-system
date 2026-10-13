import { NextResponse } from 'next/server'
import {
  finalizeMemberDeletions,
  finalizeChurchDeletions,
} from '@/lib/services/deletion.service'

/**
 * Scheduled job that permanently applies deletions whose revert/grace window
 * has elapsed. Protect with the shared cron secret, matching the other
 * `api/cron/*` routes.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [members, churches] = await Promise.all([
    finalizeMemberDeletions(),
    finalizeChurchDeletions(),
  ])

  return NextResponse.json({
    ok: true,
    membersFinalized: members.finalized,
    churchesFinalized: churches.finalized,
  })
}
