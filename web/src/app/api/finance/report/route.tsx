import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getFinanceSummary } from '@/lib/services/finance.service'
import { FinancialReportDocument } from '@/lib/pdf/financial-report'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString()
  const to = searchParams.get('to') ?? new Date().toISOString()
  const churchId = searchParams.get('churchId')

  if (!churchId) return new Response('Missing churchId', { status: 400 })

  const supabase = await createClient()
  const { data: church } = await supabase
    .from('churches')
    .select('name')
    .eq('id', churchId)
    .single()

  if (!church) return new Response('Not found', { status: 404 })

  const summary = await getFinanceSummary(churchId, from, to)
  const stream = await renderToStream(
    <FinancialReportDocument
      church={{ name: church.name }}
      range={{ from, to }}
      summary={summary}
    />
  )

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="finance-report-${from.slice(0,10)}-${to.slice(0,10)}.pdf"`,
    },
  })
}