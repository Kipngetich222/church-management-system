import { renderToBuffer } from '@react-pdf/renderer'
import { FinanceVoucherDocument } from '@/lib/pdf/finance-documents'
import {
  financeEngine,
  financeFailure,
  financeUser,
} from '@/lib/services/finance.service'
function renderVoucher(props: Parameters<typeof FinanceVoucherDocument>[0]) {
  return renderToBuffer(<FinanceVoucherDocument {...props} />)
}
export async function GET(
  req: Request,
  context: { params: Promise<{ kind: string; id: string }> }
) {
  try {
    const user = await financeUser(),
      { kind, id } = await context.params,
      churchId = new URL(req.url).searchParams.get('churchId') ?? '',
      engine = financeEngine()
    const { entry } = await engine.entry(user.id, churchId, kind, id)
    const { church } = await engine.prepareExport(user.id, churchId)
    const buffer = await renderVoucher({ churchName: church.name, entry })
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="finance-record-${id}.pdf"`,
      },
    })
  } catch (error) {
    return financeFailure(error)
  }
}
