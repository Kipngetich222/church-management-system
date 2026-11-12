import { z } from 'zod'
import { DESTINATION_TYPES, GivingError } from '@/lib/giving'
import {
  givingEngine,
  givingFailure,
  givingJson,
  givingUser,
} from '@/lib/services/giving.service'

export const maxDuration = 60

const schema = z.object({
  enabled: z.boolean(),
  destinationType: z.enum(DESTINATION_TYPES),
  destinationNumber: z.string().max(30),
  accountReference: z.string().max(12).default(''),
  businessShortCode: z.string().max(7).default(''),
  environment: z.enum(['sandbox', 'production']),
  consumerKey: z.string().max(512).optional(),
  consumerSecret: z.string().max(512).optional(),
  passkey: z.string().max(512).optional(),
})
export async function GET(req: Request) {
  try {
    const user = await givingUser()
    return givingJson(
      await givingEngine().getSettings(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? ''
      )
    )
  } catch (error) {
    return givingFailure(error)
  }
}
export async function PUT(req: Request) {
  try {
    const user = await givingUser(req)
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success)
      throw new GivingError('Check the payment setup fields and try again.')
    return givingJson(
      await givingEngine().saveSettings(
        user.id,
        new URL(req.url).searchParams.get('churchId') ?? '',
        parsed.data
      )
    )
  } catch (error) {
    return givingFailure(error)
  }
}
