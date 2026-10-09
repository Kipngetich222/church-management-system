import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ deptId: string }> }
) {
  const { deptId } = await params
  const { membershipId, isLeader } = await req.json()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update dept membership
  await admin
    .from('department_members')
    .update({ is_leader: isLeader })
    .eq('department_id', deptId)
    .eq('membership_id', membershipId)

  // If becoming leader and currently member, promote to dept_admin
  if (isLeader) {
    const { data: current } = await admin
      .from('church_memberships')
      .select('role')
      .eq('id', membershipId)
      .single()

    if (current?.role === 'member') {
      await admin
        .from('church_memberships')
        .update({ role: 'dept_admin' })
        .eq('id', membershipId)
    }
  }

  return NextResponse.json({ ok: true })
}
