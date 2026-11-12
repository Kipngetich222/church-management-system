import { renderToBuffer } from '@react-pdf/renderer'
import { ReceiptDocument } from '@/lib/pdf/receipt'
import { receiptLogo } from '@/lib/pdf/receipt-logo'
import {
  givingEngine,
  givingFailure,
  givingUser,
} from '@/lib/services/giving.service'

export const runtime = 'nodejs'
export const maxDuration = 60
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await givingUser(),
      { id } = await context.params
    const churchId = new URL(req.url).searchParams.get('churchId') ?? ''
    const offering = await givingEngine().receipt(user.id, churchId, id)
    const logo = await receiptLogo(
      offering.receipt_details.church.logo_url,
      churchId
    )
    const buffer = await renderToBuffer(
      <ReceiptDocument
        offering={offering}
        details={offering.receipt_details}
        logo={logo}
      />
    )
    const filename =
      offering.receipt_number.replace(/[^a-zA-Z0-9_-]/g, '') || offering.id
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="giving-receipt-${filename}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return givingFailure(error)
  }
}
