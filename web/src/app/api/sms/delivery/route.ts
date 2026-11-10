import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { checked, communicationDb } from '@/lib/communication'

export async function POST(req: Request) {
  const secret = process.env.SMS_DELIVERY_CALLBACK_SECRET
  const token = new URL(req.url).searchParams.get('token') || ''
  if (
    !secret ||
    Buffer.byteLength(secret) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(token))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const fields = await req.formData()
    const id = fields.get('id'),
      status = fields.get('status')
    if (typeof id !== 'string' || !id || typeof status !== 'string')
      return Response.json(
        { error: 'Invalid delivery report' },
        { status: 400 }
      )
    checked(
      await communicationDb(createAdminClient()).rpc('record_sms_delivery', {
        p_provider_id: id,
        p_status: status,
      })
    )
    return Response.json({ ok: true })
  } catch {
    return Response.json(
      { error: 'Unable to record delivery report' },
      { status: 500 }
    )
  }
}
