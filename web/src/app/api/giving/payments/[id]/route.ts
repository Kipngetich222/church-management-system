import {
  givingEngine,
  givingFailure,
  givingJson,
  givingUser,
} from '@/lib/services/giving.service'

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await givingUser(),
      { id } = await context.params
    return givingJson(
      await givingEngine().getPayment(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? '',
        id
      )
    )
  } catch (error) {
    return givingFailure(error)
  }
}
