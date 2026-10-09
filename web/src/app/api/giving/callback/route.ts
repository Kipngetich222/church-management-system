import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const callback = body?.Body?.stkCallback
  if (!callback) return NextResponse.json({ ok: true })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const reference = callback.CheckoutRequestID
  const resultCode = callback.ResultCode
  const resultDesc = callback.ResultDesc

  // Find offering by pending reference
  const { data: offering } = await admin
    .from('offerings')
    .select('id, reference')
    .eq('reference', reference)
    .single()

  if (!offering) return NextResponse.json({ ok: true })

  if (resultCode === 0) {
    const items = callback.CallbackMetadata?.Item ?? []
    const receipt = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value
    await admin
      .from('offerings')
      .update({
        reference: receipt ?? reference,
        notes: 'M-Pesa confirmed',
      })
      .eq('id', offering.id)
  } else {
    await admin
      .from('offerings')
      .update({ notes: `M-Pesa failed: ${resultDesc}` })
      .eq('id', offering.id)
  }

  return NextResponse.json({ ok: true })
}