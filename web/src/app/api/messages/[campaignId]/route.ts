import { z } from 'zod'
import { checked, CommunicationError } from '@/lib/communication'
import { communicationEngine } from '@/lib/services/communication.service'
import {
  campaignSchema,
  communicationActor,
  communicationFailure,
} from '@/lib/services/communication-api'

const schema = campaignSchema.extend({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  cancel: z.boolean().default(false),
})
export async function PATCH(
  req: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const input = schema.parse(await req.json())
    const { campaignId } = await context.params
    z.string().uuid().parse(campaignId)
    const { user, membership, db } = await communicationActor(input.churchId)
    const current = checked(
      await db
        .from('message_campaigns')
        .select('id, created_by')
        .eq('id', campaignId)
        .eq('church_id', input.churchId)
        .maybeSingle()
    )
    if (!current) throw new CommunicationError('Campaign not found', 404)
    if (membership.role !== 'super_admin' && current.created_by !== user.id) {
      throw new CommunicationError('You cannot edit this campaign', 403)
    }
    if (!input.cancel) {
      if (!current.created_by)
        throw new CommunicationError(
          'The original sender no longer has an account. Create a new message instead.'
        )
      const preview = await communicationEngine().preview(
        input,
        current.created_by
      )
      if (!preview.reachable)
        throw new CommunicationError(
          'No reachable recipients match this selection'
        )
    }
    const campaign = checked(
      await db.rpc('edit_scheduled_message', {
        p_id: campaignId,
        p_actor: user.id,
        p_expected: input.expectedUpdatedAt,
        p_body: input.body,
        p_channel: input.channel,
        p_subject: input.subject ?? null,
        p_filter: input.recipientFilter,
        p_scheduled: input.scheduledAt ?? null,
        p_cancel: input.cancel,
      })
    )
    return Response.json(campaign)
  } catch (error) {
    return communicationFailure(error)
  }
}
