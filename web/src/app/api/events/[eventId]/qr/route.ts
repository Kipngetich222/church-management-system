import { createClient } from '@/lib/supabase/server'
import { generateQrDataUrl, buildEventQrUrl } from '@/lib/services/qr.service'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, church_id')
    .eq('id', eventId)
    .single()

  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // The QR encodes a plain URL so any phone camera opens the event page. The
  // `/e/:id` route then routes members and visitors to the right place.
  const dataUrl = await generateQrDataUrl(buildEventQrUrl(event.id))

  // Persist the data URL on the event so the admin panel can redisplay it.
  await supabase.from('events').update({ qr_code: dataUrl }).eq('id', eventId)

  return NextResponse.json({ qr_code: dataUrl })
}
