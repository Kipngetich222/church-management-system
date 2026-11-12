import { z } from 'zod'
import { checked, CommunicationError } from '@/lib/communication'
import {
  communicationActor,
  communicationFailure,
} from '@/lib/services/communication-api'
import {
  verifySmsPurchase,
  type SmsPurchase,
} from '@/lib/services/sms-purchases.service'

export const maxDuration = 60

export async function POST(
  req: Request,
  context: { params: Promise<{ purchaseId: string }> }
) {
  try {
    const { churchId } = z
      .object({ churchId: z.string().uuid() })
      .parse(await req.json())
    const { purchaseId } = await context.params
    z.string().uuid().parse(purchaseId)
    const { db } = await communicationActor(churchId, true)
    const purchase = checked(
      await db
        .from('sms_purchases')
        .select('*')
        .eq('id', purchaseId)
        .eq('church_id', churchId)
        .maybeSingle()
    ) as SmsPurchase | null
    if (!purchase) throw new CommunicationError('Purchase not found', 404)
    return Response.json(await verifySmsPurchase(purchase))
  } catch (error) {
    return communicationFailure(error)
  }
}
