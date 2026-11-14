import { FinanceError, financeRecord } from '@/lib/finance'
import {
  financeEngine,
  financeFailure,
  financeJson,
  financeUser,
} from '@/lib/services/finance.service'
export async function GET(req: Request) {
  try {
    const user = await financeUser(),
      params = new URL(req.url).searchParams,
      church = params.get('churchId') ?? '',
      engine = financeEngine()
    const kind = params.get('kind')
    if (kind === 'campaign')
      return financeJson(await engine.campaigns(user.id, church))
    if (kind === 'pledge')
      return financeJson(await engine.pledges(user.id, church))
    if (kind === 'budget')
      return financeJson(await engine.budgets(user.id, church))
    throw new FinanceError('Select a valid plan type.')
  } catch (error) {
    return financeFailure(error)
  }
}
export async function POST(req: Request) {
  try {
    const user = await financeUser(req),
      input = financeRecord(await req.json())
    return financeJson(
      await financeEngine().createPlan(
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
