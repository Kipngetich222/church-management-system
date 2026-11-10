import { communicationEngine } from '@/lib/services/communication.service'
import {
  campaignSchema,
  communicationActor,
  communicationFailure,
} from '@/lib/services/communication-api'

export const maxDuration = 300
export async function POST(req: Request) {
  try {
    const input = campaignSchema.parse(await req.json())
    const { user } = await communicationActor(input.churchId)
    const campaign = await communicationEngine().create(input, user.id)
    return Response.json({
      campaignId: campaign.id,
      status: campaign.status,
      error: campaign.error,
    })
  } catch (error) {
    return communicationFailure(error)
  }
}
