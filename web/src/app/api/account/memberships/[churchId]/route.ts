import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withdrawMembership } from '@/lib/services/membership.service'

/**
 * Withdraw the signed-in member from a single church.
 *
 * The member keeps their account and any other memberships, and is free to
 * browse and join another church afterwards. If they were the church's only
 * super admin, ownership is handed to another leader (or the church is removed
 * when nobody is left) so the church is never orphaned.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  const { churchId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this church.' },
      { status: 404 }
    )
  }

  try {
    const result = await withdrawMembership({
      userId: user.id,
      churchId,
      actorId: user.id,
    })

    const { count } = await supabase
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({ result, membershipsRemaining: count ?? 0 })
  } catch (error) {
    const message =
      (error as Error).message ?? 'Could not withdraw from this church'
    // PostgREST reports the RPC as missing when migration 0020 has not been
    // applied yet; surface that plainly instead of a cryptic 400.
    if (message.includes('withdraw_membership')) {
      return NextResponse.json(
        {
          error:
            'Withdrawal is not available yet: the membership database migration has not been applied.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
