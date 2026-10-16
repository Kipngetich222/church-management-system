import { createClient } from '@/lib/supabase/server'
import { generateQrDataUrl, buildServiceQrUrl } from '@/lib/services/qr.service'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
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

  // Encode the canonical app URL (NEXT_PUBLIC_APP_URL) so a scanned code always
  // opens the deployed app - never the machine the code happened to be
  // generated on. The QR is a plain URL, so any phone camera opens the service
  // page, where members follow the programme and check in on the day.
  const dataUrl = await generateQrDataUrl(buildServiceQrUrl(service.id))

  await supabase
    .from('recurring_services')
    .update({ qr_code: dataUrl })
    .eq('id', serviceId)

  return NextResponse.json({ qr_code: dataUrl })
}
