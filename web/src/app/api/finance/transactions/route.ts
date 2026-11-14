import {
  financeEngine,
  financeFailure,
  financeJson,
  financeParams,
  financeUser,
} from '@/lib/services/finance.service'
export async function GET(req: Request) {
  try {
    const user = await financeUser(),
      { churchId, filters } = financeParams(new URL(req.url).searchParams)
    return financeJson(
      await financeEngine().history(user.id, churchId, filters)
    )
  } catch (error) {
    return financeFailure(error)
  }
}
