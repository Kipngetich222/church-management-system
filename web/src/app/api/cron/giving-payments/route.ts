import {
  givingEngine,
  givingFailure,
  givingJson,
} from '@/lib/services/giving.service'

export const maxDuration = 60
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return givingJson(await givingEngine().reconcilePending())
  } catch (error) {
    return givingFailure(error)
  }
}
