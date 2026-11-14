import {
  financeEngine,
  financeFailure,
  financeJson,
  financeUser,
} from '@/lib/services/finance.service'
type Context = { params: Promise<{ kind: string; id: string }> }
export async function GET(req: Request, context: Context) {
  try {
    const user = await financeUser(),
      { kind, id } = await context.params
    return financeJson(
      await financeEngine().entry(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? '',
        kind,
        id
      )
    )
  } catch (error) {
    return financeFailure(error)
  }
}
export async function PATCH(req: Request, context: Context) {
  try {
    const user = await financeUser(req),
      { kind, id } = await context.params
    return financeJson(
      await financeEngine().changeEntry(
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
