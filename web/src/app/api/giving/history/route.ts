import {
  givingEngine,
  givingFailure,
  givingHistoryParams,
  givingJson,
  givingUser,
} from '@/lib/services/giving.service'

export async function GET(req: Request) {
  try {
    const user = await givingUser(),
      { churchId, scope, filters } = givingHistoryParams(req)
    return givingJson(
      await givingEngine().history(user.id, churchId, scope, filters)
    )
  } catch (error) {
    return givingFailure(error)
  }
}
