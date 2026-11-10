import { communicationEngine } from '@/lib/services/communication.service'
import { z } from 'zod'
import { checked, CommunicationError } from '@/lib/communication'
import {
  campaignSchema,
  communicationActor,
  communicationFailure,
} from '@/lib/services/communication-api'

export async function POST(req: Request) {
  try {
    const input = campaignSchema
      .extend({ campaignId: z.string().uuid().optional() })
      .parse(await req.json())
    const { user, membership, db } = await communicationActor(input.churchId)
    let senderId = user.id
    if (input.campaignId) {
      const campaign = checked(
        await db
          .from('message_campaigns')
          .select('created_by')
          .eq('id', input.campaignId)
          .eq('church_id', input.churchId)
          .maybeSingle()
      )
      if (
        !campaign ||
        (membership.role !== 'super_admin' && campaign.created_by !== user.id)
      )
        throw new CommunicationError('You cannot preview this campaign', 403)
      if (!campaign.created_by)
        throw new CommunicationError(
          'The original sender no longer has an account'
        )
      senderId = campaign.created_by
    }
    return Response.json(await communicationEngine().preview(input, senderId))
  } catch (error) {
    return communicationFailure(error)
  }
}
