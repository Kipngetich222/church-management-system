import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { TableReportDocument } from '@/lib/pdf/table-report'

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'report'
}

/**
 * Render an admin table export (attendance, bookings, events, register ...) as
 * a printable PDF. The client posts the already-visible header row plus data
 * rows, so every export stays in sync with what the screen shows.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let payload: {
    title?: string
    subtitle?: string
    columns?: unknown
    rows?: unknown
    filename?: string
  }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const columns = Array.isArray(payload.columns)
    ? payload.columns.map((column) => String(column ?? ''))
    : []
  const rows = Array.isArray(payload.rows)
    ? (payload.rows as unknown[][]).map((row) =>
        Array.isArray(row) ? row.map((value) => String(value ?? '')) : []
      )
    : []

  if (columns.length === 0) {
    return new Response('Missing columns', { status: 400 })
  }

  const title = payload.title?.trim() || 'Report'
  const filename = safeFilename(payload.filename?.trim() || 'report')

  const stream = await renderToStream(
    <TableReportDocument
      title={title}
      subtitle={payload.subtitle}
      columns={columns}
      rows={rows}
    />
  )

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  })
}