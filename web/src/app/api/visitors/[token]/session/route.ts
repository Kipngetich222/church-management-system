import { NextResponse } from 'next/server'
import { visitorCookieName, visitorTokenSchema } from '@/lib/visitors'
import { rejectCrossOrigin } from '@/lib/services/visitors.service'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const blocked = rejectCrossOrigin(request)
  if (blocked) return blocked
  const { token } = await params
  if (!visitorTokenSchema.safeParse(token).success)
    return NextResponse.json(
      { error: 'Invalid welcome link.' },
      { status: 404 }
    )
  const response = NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  response.cookies.set(visitorCookieName(token), '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
