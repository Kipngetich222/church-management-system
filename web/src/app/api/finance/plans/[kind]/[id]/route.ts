import {
  financeEngine,
  financeFailure,
  financeJson,
  financeUser,
} from '@/lib/services/finance.service'
export async function PATCH(
  req: Request,
  context: { params: Promise<{ kind: string; id: string }> }
) {
  try {
    const user = await financeUser(req),
      { kind, id } = await context.params
    return financeJson(
      await financeEngine().changePlan(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? '',
        kind,
        id,
        await req.json()
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
