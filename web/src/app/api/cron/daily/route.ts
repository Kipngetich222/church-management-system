import { NextResponse } from 'next/server'
import { GET as runBirthdays } from '../birthdays/route'
import { GET as runEventReminders } from '../event-reminders/route'
import { GET as runScheduledMessages } from '../scheduled-messages/route'
import { GET as runFinalizeDeletions } from '../finalize-deletions/route'

/**
 * Single daily maintenance job.
 *
 * Vercel's Hobby plan only allows two cron jobs and requires them to run at most
 * once a day, so while developing on Hobby every scheduled job is fanned out
 * from this one endpoint. Each `api/cron/*` route still exists and works on its
 * own, so on a Pro plan you can split these back into separate `vercel.json`
 * entries with their own schedules.
 *
 * Note: deletions are applied in real time by the deletion flow itself (on
 * access and from the member's countdown), so this daily run is only a backstop.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  async function run(
    name: string,
    handler: (request: Request) => Promise<Response>
  ) {
    try {
      const res = await handler(req)
      return [name, await res.json().catch(() => null)] as const
    } catch (error) {
      return [name, { error: (error as Error).message }] as const
    }
  }

  const jobs: [string, (request: Request) => Promise<Response>][] = [
    ['birthdays', runBirthdays],
    ['eventReminders', runEventReminders],
    ['scheduledMessages', runScheduledMessages],
    ['deletions', runFinalizeDeletions],
  ]

  const results: Record<string, unknown> = {}
  for (const [name, handler] of jobs) {
    const [key, body] = await run(name, handler)
    results[key] = body
  }

  return NextResponse.json({ ok: true, ...results })
}
