import { financeRecord } from '@/lib/finance'
import {
  financeEngine,
  financeFailure,
  financeJson,
  financeUser,
} from '@/lib/services/finance.service'
export async function GET(req: Request) {
  try {
    const user = await financeUser()
    return financeJson(
      await financeEngine().categories(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? ''
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
export async function POST(req: Request) {
  try {
    const user = await financeUser(req),
      input = financeRecord(await req.json())
    return financeJson(
      await financeEngine().createCategory(
        user.id,
        String(input.churchId ?? ''),
        input
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
