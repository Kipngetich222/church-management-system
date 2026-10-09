import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { MembersReportDocument } from '@/lib/pdf/members-report'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const churchId = searchParams.get('churchId')
  if (!churchId) return new Response('Missing churchId', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Verify the current user is an admin of this church
  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .single()

  if (!membership || !['super_admin', 'dept_admin'].includes(membership.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const [{ data: church }, { data: members }] = await Promise.all([
    supabase.from('churches').select('name').eq('id', churchId).single(),
    supabase
      .from('church_memberships')
      .select(`
        role, badges, is_baptized, joined_at,
        users(full_name, email, phone)
      `)
      .eq('church_id', churchId)
      .order('joined_at'),
  ])

  if (!church) return new Response('Church not found', { status: 404 })

  const rows = (members ?? []).map((m: any) => ({
    full_name: m.users?.full_name ?? null,
    email: m.users?.email ?? '',
    phone: m.users?.phone ?? null,
    role: m.role,
    badges: m.badges ?? [],
    is_baptized: m.is_baptized ?? false,
    joined_at: m.joined_at,
  }))

  const stream = await renderToStream(
    <MembersReportDocument church={{ name: church.name }} members={rows} />
  )

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="members-${churchId}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}