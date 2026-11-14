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
      params = new URL(req.url).searchParams,
      { churchId, filters } = financeParams(params)
    const entity = params.get('entityId')
      ? { id: params.get('entityId')!, kind: params.get('entityType') ?? '' }
      : undefined
    return financeJson(
      await financeEngine().audit(user.id, churchId, filters, entity)
    )
  } catch (error) {
    return financeFailure(error)
  }
}
