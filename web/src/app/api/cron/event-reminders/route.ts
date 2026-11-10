import { communicationEngine } from '@/lib/services/communication.service'
import { communicationFailure } from '@/lib/services/communication-api'
import { runEventReminderMessages } from '../../../../../../src/modules/messages/communication-automation'
export const maxDuration = 300
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return Response.json(await runEventReminderMessages(communicationEngine()))
  } catch (error) {
    return communicationFailure(error)
  }
}
