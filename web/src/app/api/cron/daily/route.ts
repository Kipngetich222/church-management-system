import { NextResponse } from 'next/server'
import { GET as runBirthdays } from '../birthdays/route'
import { GET as runEventReminders } from '../event-reminders/route'
import { GET as runFinalizeDeletions } from '../finalize-deletions/route'
import { GET as reconcileGiving } from '../giving-payments/route'

/**
 * Single daily maintenance job.
 *
 * On Vercel Hobby, scheduled communication has its own daily invocation so
 * maintenance does not share its time budget with SMS-credit reconciliation and
 * scheduled messages. This endpoint handles giving-payment reconciliation,
 * greetings, reminders and deletion.
 *
 * Note: deletions are applied in real time by the deletion flow itself (on
 * access and from the member's countdown), so this daily run is only a backstop.
 */
export const maxDuration = 300

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
    ['givingPayments', reconcileGiving],
    ['birthdays', runBirthdays],
    ['eventReminders', runEventReminders],
    ['deletions', runFinalizeDeletions],
  ]

  const results: Record<string, unknown> = {}
  for (const [name, handler] of jobs) {
    const [key, body] = await run(name, handler)
    results[key] = body
  }

  return NextResponse.json({ ok: true, ...results })
}
