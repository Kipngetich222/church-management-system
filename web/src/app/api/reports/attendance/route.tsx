import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { AttendanceReportDocument } from '@/lib/pdf/attendance-report'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const churchId = searchParams.get('churchId')
  const from =
    searchParams.get('from') ??
    new Date(new Date().getFullYear(), 0, 1).toISOString()
  const to = searchParams.get('to') ?? new Date().toISOString()

  if (!churchId) return new Response('Missing churchId', { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: membership } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .single()

  if (!membership || !['super_admin', 'dept_admin'].includes(membership.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const [{ data: church }, { data: attendance }] = await Promise.all([
    supabase.from('churches').select('name').eq('id', churchId).single(),
    supabase
      .from('events')
      .select(`
        title, start_time,
        event_attendance(id)
      `)
      .eq('church_id', churchId)
      .gte('start_time', from)
      .lte('start_time', to)
      .order('start_time', { ascending: false }),
  ])

  if (!church) return new Response('Church not found', { status: 404 })

  const rows = (attendance ?? []).map((e: any) => ({
    event_title: e.title,
    event_date: e.start_time,
    count: e.event_attendance?.length ?? 0,
  }))

  const stream = await renderToStream(
    <AttendanceReportDocument
      church={{ name: church.name }}
      range={{ from, to }}
      rows={rows}
    />
  )

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attendance-${from.slice(0, 10)}-${to.slice(0, 10)}.pdf"`,
    },
  })
}