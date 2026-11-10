import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { checked, communicationDb } from '@/lib/communication'
import {
  validPaymentCallback,
  verifySmsPurchase,
  type SmsPurchase,
} from '@/lib/services/sms-purchases.service'

export async function POST(req: Request) {
  const url = new URL(req.url),
    id = url.searchParams.get('id') || ''
  if (
    !z.string().uuid().safeParse(id).success ||
    !validPaymentCallback(id, url.searchParams.get('token') || '')
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const callback = body?.Body?.stkCallback
    const db = communicationDb(createAdminClient())
    const purchase = checked(
      await db.from('sms_purchases').select('*').eq('id', id).maybeSingle()
    ) as SmsPurchase | null
    if (
      !purchase ||
      !callback ||
      purchase.checkout_id !== callback.CheckoutRequestID
    )
      return Response.json(
        { error: 'Payment not ready for confirmation' },
        { status: 409 }
      )
    // Receipt metadata is retained only if amount and payer match the request.
    const items: { Name: string; Value: unknown }[] = Array.isArray(
      callback.CallbackMetadata?.Item
    )
      ? callback.CallbackMetadata.Item
      : []
    const value = (name: string) =>
      items.find((item) => item.Name === name)?.Value
    const receipt =
      Number(value('Amount')) === purchase.amount_kes &&
      String(value('PhoneNumber')) === purchase.phone &&
      typeof value('MpesaReceiptNumber') === 'string'
        ? String(value('MpesaReceiptNumber'))
        : undefined
    await verifySmsPurchase(purchase, receipt)
    return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch {
    return Response.json(
      { error: 'Confirmation pending; automatic reconciliation will retry' },
      { status: 503 }
    )
  }
}
