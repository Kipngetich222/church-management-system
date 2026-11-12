import { z } from 'zod'
import {
  communicationActor,
  communicationFailure,
} from '@/lib/services/communication-api'
import { purchaseSms } from '@/lib/services/sms-purchases.service'

export const maxDuration = 60

const schema = z.object({
  churchId: z.string().uuid(),
  requestId: z.string().uuid(),
  credits: z.number().int().positive(),
  phone: z.string().min(8).max(30),
  quotedAmountKes: z.number().int().positive().optional(),
})
export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json())
    const { user, membership } = await communicationActor(input.churchId, true)
    return Response.json(
      await purchaseSms(
        input,
        user.id,
        membership.full_name || user.email || 'Super administrator'
      )
    )
  } catch (error) {
    return communicationFailure(error)
  }
}
