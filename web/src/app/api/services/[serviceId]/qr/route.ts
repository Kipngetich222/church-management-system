import { createClient } from '@/lib/supabase/server'
import { generateQrDataUrl, buildServiceQrUrl } from '@/lib/services/qr.service'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params
  const supabase = await createClient()

  const { data: service } = await supabase
    .from('recurring_services')
    .select('id, church_id')
    .eq('id', serviceId)
    .single()

  if (!service)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Encode the URL of the app the admin is generating the code from, so a
  // freshly generated code always points at a host that can serve `/s/:id`
  // (falling back to the canonical app URL for server-side callers). The QR
  // encodes a plain URL so any phone camera opens the service page, where
  // members can follow the programme and check in on the day.
  const origin = new URL(req.url).origin
  const dataUrl = await generateQrDataUrl(buildServiceQrUrl(service.id, origin))

  await supabase
    .from('recurring_services')
    .update({ qr_code: dataUrl })
    .eq('id', serviceId)

  return NextResponse.json({ qr_code: dataUrl })
}
