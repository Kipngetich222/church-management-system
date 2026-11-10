import { communicationEngine } from '@/lib/services/communication.service'
import { communicationFailure } from '@/lib/services/communication-api'
import { reconcileSmsPurchases } from '@/lib/services/sms-purchases.service'

export const maxDuration = 300
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const purchases = await reconcileSmsPurchases()
    const results = await communicationEngine().runScheduled()
    return Response.json({ results, purchases })
  } catch (error) {
    return communicationFailure(error)
  }
}
