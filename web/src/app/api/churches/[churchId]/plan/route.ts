import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { changeChurchPlan } from '@/lib/services/plan.service'

const bodySchema = z.object({
  plan: z.enum(['starter', 'growth']),
})

/**
 * Change a church's plan. Only a super admin of the church may do this, and
 * every plan unlocks the same features - the caller is picking how many members
 * the church can hold.
 */
export async function POST(
  request: Request,
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
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .maybeSingle()

  if (!membership || membership.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Only a super admin can change the church plan.' },
      { status: 403 }
    )
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a valid plan.' }, { status: 400 })
  }

  try {
    const usage = await changeChurchPlan({
      churchId,
      plan: parsed.data.plan,
      actorId: user.id,
    })
    return NextResponse.json({ usage })
  } catch (error) {
    console.error('Failed to change church plan:', error)
    return NextResponse.json(
      { error: 'We could not change your plan right now. Please try again.' },
      { status: 500 }
    )
  }
}
