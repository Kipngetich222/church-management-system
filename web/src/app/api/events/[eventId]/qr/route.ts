import { createClient } from '@/lib/supabase/server'
import { generateQrDataUrl, buildEventQrPayload } from '@/lib/services/qr.service'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, church_id, qr_code')
    .eq('id', eventId)
    .single()

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payload = buildEventQrPayload(event.id, event.church_id)
  const dataUrl = await generateQrDataUrl(payload)

  // Persist the data URL on the event
  await supabase
    .from('events')
    .update({ qr_code: dataUrl })
    .eq('id', eventId)

  return NextResponse.json({ qr_code: dataUrl })
}