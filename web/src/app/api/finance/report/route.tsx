import { renderToBuffer } from '@react-pdf/renderer'
import { FinanceError, type FinanceEntry } from '@/lib/finance'
import {
  financeEngine,
  financeFailure,
  financeParams,
  financeUser,
} from '@/lib/services/finance.service'
import {
  financeAuditCsv,
  financeSummaryCsv,
  financeTransactionsCsv,
} from '../../../../../../src/modules/finance/finance-csv'
import { financeCsvResponse } from '@/lib/finance-stream'
import { FinancialReportDocument } from '@/lib/pdf/financial-report'
import { FinanceRegisterDocument } from '@/lib/pdf/finance-documents'

export const maxDuration = 60
function renderRegister(props: Parameters<typeof FinanceRegisterDocument>[0]) {
  return renderToBuffer(<FinanceRegisterDocument {...props} />)
}
function renderSummary(props: Parameters<typeof FinancialReportDocument>[0]) {
  return renderToBuffer(<FinancialReportDocument {...props} />)
}
export async function GET(req: Request) {
  try {
    const user = await financeUser(),
      params = new URL(req.url).searchParams,
      { churchId, filters } = financeParams(params),
      engine = financeEngine()
    const format = params.get('format') || 'pdf',
      report = params.get('report') || 'summary'
    if (
      !['csv', 'pdf'].includes(format) ||
      !['summary', 'transactions', 'audit'].includes(report)
    )
      throw new FinanceError('Select a supported report and file format.')
    if (report === 'audit') {
      if (format !== 'csv')
        throw new FinanceError('Change history is available as CSV.')
      const entity = params.get('entityId')
        ? { id: params.get('entityId')!, kind: params.get('entityType') ?? '' }
        : undefined
      return financeCsvResponse(
        financeAuditCsv(
          await engine.prepareAuditExport(user.id, churchId, filters, entity)
        ),
        'finance-change-history.csv'
      )
    }
    const data = await engine.prepareExport(user.id, churchId, filters)
    const filename = `finance-${report}-${data.filters.from || 'all'}-${data.filters.to || 'latest'}`
    if (report === 'transactions') {
      if (format === 'csv')
        return financeCsvResponse(
          financeTransactionsCsv(data.church.name, data.rows),
          `${filename}.csv`
        )
      const rows: FinanceEntry[] = []
      for await (const row of data.rows) rows.push(row)
      const filterLabel = Object.entries(data.filters)
        .filter(
          ([key, value]) =>
            value && !['from', 'to', 'page', 'pageSize'].includes(key)
        )
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ')
      const buffer = await renderRegister({
        churchName: data.church.name,
        rows,
        period: data.filters,
        filters: filterLabel,
      })
      return pdf(buffer, `${filename}.pdf`)
    }
    const { period, summary } = await engine.summary(user.id, churchId, filters)
    if (format === 'csv')
      return new Response(
        financeSummaryCsv(data.church.name, period, summary),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'Content-Disposition': `attachment; filename="finance-summary-${period.from}-${period.to}.csv"`,
          },
        }
      )
    const buffer = await renderSummary({
      church: data.church,
      period,
      summary,
    })
    return pdf(buffer, `finance-summary-${period.from}-${period.to}.pdf`)
  } catch (error) {
    return financeFailure(error)
  }
}
function pdf(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
