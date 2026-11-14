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
      await financeEngine().options(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? ''
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
