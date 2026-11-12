import { z } from 'zod'
import { GIVING_TYPES, MAX_GIVING_AMOUNT, GivingError } from '@/lib/giving'
import {
  givingEngine,
  givingFailure,
  givingJson,
  givingUser,
} from '@/lib/services/giving.service'

export const maxDuration = 60
const schema = z.object({
  churchId: z.string().uuid(),
  requestId: z.string().uuid(),
  amount: z.number().int().min(1).max(MAX_GIVING_AMOUNT),
  phone: z.string().max(30),
  type: z.enum(GIVING_TYPES),
})
export async function POST(req: Request) {
  try {
    const user = await givingUser(req)
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success)
      throw new GivingError(
        'Enter a whole-shilling amount, M-Pesa phone number and valid giving type.'
      )
    return givingJson(await givingEngine().start(user.id, parsed.data))
  } catch (error) {
    return givingFailure(error)
  }
}
