import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { visitorTokenSchema, visitorWelcomeSchema } from '@/lib/visitors'
import {
  rejectCrossOrigin,
  visitorAdminClient,
  visitorErrorResponse,
  visitorQrCode,
} from '@/lib/services/visitors.service'

type Context = { params: Promise<{ churchId: string }> }

export async function GET(_request: Request, context: Context) {
  const { churchId } = await context.params
  if (!visitorTokenSchema.safeParse(churchId).success)
    return NextResponse.json({ error: 'Invalid church.' }, { status: 400 })
  const auth = await visitorAdminClient(churchId)
  if (auth.response) return auth.response
  const { data, error } = await auth
    .supabase!.from('visitor_portals')
    .select('*')
    .eq('church_id', churchId)
    .maybeSingle()
  if (error) return visitorErrorResponse(error)
  return NextResponse.json(
    data ? { ...data, ...(await visitorQrCode(data.token)) } : null,
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request, context: Context) {
  const blocked = rejectCrossOrigin(request)
  if (blocked) return blocked
  const { churchId } = await context.params
  if (!visitorTokenSchema.safeParse(churchId).success)
    return NextResponse.json({ error: 'Invalid church.' }, { status: 400 })
  const auth = await visitorAdminClient(churchId)
  if (auth.response) return auth.response
  const { data, error } = await auth
    .supabase!.rpc('ensure_visitor_portal', { p_church_id: churchId })
    .single()
  if (error) return visitorErrorResponse(error)
  revalidatePath('/admin/visitors')
  return NextResponse.json(
    { ...data, ...(await visitorQrCode(data.token)) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function PATCH(request: Request, context: Context) {
  const blocked = rejectCrossOrigin(request)
  if (blocked) return blocked
  const { churchId } = await context.params
  if (!visitorTokenSchema.safeParse(churchId).success)
    return NextResponse.json({ error: 'Invalid church.' }, { status: 400 })
  const auth = await visitorAdminClient(churchId)
  if (auth.response) return auth.response
  const parsed = visitorWelcomeSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid welcome message.' },
      { status: 400 }
    )
  const { data, error } = await auth
    .supabase!.from('visitor_portals')
    .update(parsed.data)
    .eq('church_id', churchId)
    .select('*')
    .maybeSingle()
  if (error) return visitorErrorResponse(error)
  if (!data)
    return NextResponse.json(
      { error: 'Generate the visitor QR code first.' },
      { status: 404 }
    )
  revalidatePath('/admin/visitors')
  revalidatePath(`/visit/${data.token}`)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
