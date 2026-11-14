import { FinanceError } from '@/lib/finance'
import {
  financeEngine,
  financeFailure,
  financeJson,
  financeUser,
} from '@/lib/services/finance.service'
export async function POST(req: Request) {
  try {
    const user = await financeUser(req)
    if (Number(req.headers.get('content-length') ?? 0) > 11_000_000)
      throw new FinanceError('The document must be no larger than 10 MB.', 413)
    const form = await req.formData(),
      file = form.get('file')
    if (!(file instanceof File))
      throw new FinanceError('Choose a supporting document.')
    if (file.size > 10_485_760)
      throw new FinanceError('The document must be no larger than 10 MB.', 413)
    return financeJson(
      await financeEngine().uploadDocument(
        user.id,
        String(form.get('churchId') ?? ''),
        String(form.get('kind') ?? ''),
        String(form.get('id') ?? ''),
        {
          bytes: new Uint8Array(await file.arrayBuffer()),
          name: file.name,
          type: file.type,
        }
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
