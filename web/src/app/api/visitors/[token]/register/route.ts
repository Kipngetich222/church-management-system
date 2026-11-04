import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import {
  VISITOR_SESSION_SECONDS,
  visitorCookieName,
  visitorRegistrationSchema,
  visitorTokenSchema,
} from '@/lib/visitors'
import {
  rejectCrossOrigin,
  visitorSessionErrorResponse,
} from '@/lib/services/visitors.service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const blocked = rejectCrossOrigin(request)
  if (blocked) return blocked
  const { token } = await params
  if (!visitorTokenSchema.safeParse(token).success)
    return NextResponse.json(
      { error: 'This welcome link is invalid.' },
      { status: 404 }
    )
  const parsed = visitorRegistrationSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Please check your details.',
      },
      { status: 400 }
    )
  const input = parsed.data
  const { error } = await createPublicClient().rpc('register_church_visitor', {
    p_token: token,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_email: input.email,
    p_comment: input.comment,
    p_session_token: input.registrationToken,
  })
  if (error) return visitorSessionErrorResponse(error)
  const response = NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  response.cookies.set(visitorCookieName(token), input.registrationToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VISITOR_SESSION_SECONDS,
  })
  revalidatePath('/admin/visitors')
  revalidatePath('/admin/dashboard')
  return response
}
