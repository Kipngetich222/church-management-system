import { financeRecord } from '@/lib/finance'
import {
  financeEngine,
  financeFailure,
  financeJson,
  financeUser,
} from '@/lib/services/finance.service'
export async function POST(req: Request) {
  try {
    const user = await financeUser(req),
      input = financeRecord(await req.json())
    return financeJson(
      await financeEngine().createEntry(
        user.id,
        String(input.churchId ?? ''),
        String(input.kind ?? ''),
        input
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
