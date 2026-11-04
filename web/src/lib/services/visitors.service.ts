import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { appBaseUrl } from '@/lib/utils/app-url'

export async function requireVisitorAdmin() {
  const ctx = await getActiveChurch()
  const supabase = await createClient()
  const { data: allowed, error } = await supabase.rpc('is_visitor_admin', {
    p_church_id: ctx.churchId,
  })
  if (error)
    throw new Error(
      'Unable to load visitors. Please check that the latest database migrations have been applied.'
    )
  if (!allowed) redirect('/admin/dashboard?error=forbidden')
  return ctx
}

export async function visitorAdminClient(churchId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return {
      response: NextResponse.json(
        { error: 'Please sign in.' },
        { status: 401 }
      ),
    }
  const { data: allowed, error } = await supabase.rpc('is_visitor_admin', {
    p_church_id: churchId,
  })
  if (error) return { response: visitorErrorResponse(error) }
  if (!allowed)
    return {
      response: NextResponse.json(
        { error: 'Only a super admin of this church can manage its visitors.' },
        { status: 403 }
      ),
    }
  return { supabase }
}

export async function visitorQrCode(token: string) {
  const url = `${appBaseUrl()}/visit/${token}`
  const qr_code = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 1000,
  })
  return { url, qr_code }
}

export function visitorErrorResponse(error: {
  code?: string
  message: string
}) {
  const status =
    error.code === '42501'
      ? 403
      : error.code === 'P0002'
        ? 404
        : error.code === 'P0001'
          ? 429
          : ['22023', '23514', '23502', '22P02'].includes(error.code ?? '')
            ? 400
            : 503
  if (status === 503) console.error('Visitor operation failed:', error.code)
  return NextResponse.json(
    {
      error:
        status === 503
          ? 'Visitors are temporarily unavailable. Please try again shortly.'
          : error.message,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get('origin')
  // A reverse proxy can expose the public site while Next sees a local URL.
  // Trust the configured web origin, never an arbitrary forwarded Host header.
  const allowedOrigins = [
    new URL(request.url).origin,
    new URL(appBaseUrl()).origin,
  ]
  const originUrl = origin && URL.canParse(origin) ? new URL(origin) : null
  const matchesHost =
    originUrl &&
    ['http:', 'https:'].includes(originUrl.protocol) &&
    originUrl.origin === origin &&
    originUrl.host === request.headers.get('host')?.toLowerCase()
  if (origin && !allowedOrigins.includes(origin) && !matchesHost) {
    return NextResponse.json(
      { error: 'This request must come from the visitor page.' },
      { status: 403 }
    )
  }
  return null
}

export function visitorSessionErrorResponse(error: {
  code?: string
  message: string
}) {
  if (error.code !== '42501') return visitorErrorResponse(error)
  return NextResponse.json(
    {
      error:
        'Your visitor session has expired. Please register again to continue.',
      code: 'VISITOR_SESSION_EXPIRED',
    },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )
}
