import {
  givingEngine,
  givingFailure,
  givingJson,
  givingUser,
} from '@/lib/services/giving.service'

export const maxDuration = 60
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await givingUser(req),
      { id } = await context.params
    return givingJson(
      await givingEngine().verifyPayment(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? '',
        id
      )
    )
  } catch (error) {
    return givingFailure(error)
  }
}
