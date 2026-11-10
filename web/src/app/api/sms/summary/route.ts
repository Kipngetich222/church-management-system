import { createClient } from '@/lib/supabase/server'
import { checked, communicationDb } from '@/lib/communication'
import {
  communicationActor,
  communicationFailure,
} from '@/lib/services/communication-api'
import { smsEnvironment } from '@/lib/services/communication.service'

export async function GET(req: Request) {
  try {
    const churchId = new URL(req.url).searchParams.get('churchId') || ''
    await communicationActor(churchId)
    const summary = checked(
      await communicationDb(await createClient()).rpc('sms_usage_summary', {
        p_church: churchId,
        p_environment: smsEnvironment(),
      })
    )
    return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return communicationFailure(error)
  }
}
