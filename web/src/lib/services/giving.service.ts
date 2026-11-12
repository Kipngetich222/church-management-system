import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/utils/app-url'
import { GivingEngine } from '../../../../src/modules/giving/giving-engine'
import { GivingError, type GivingHistoryFilters } from '@/lib/giving'

export function givingEngine() {
  return new GivingEngine(createAdminClient(), {
    publicUrl: appBaseUrl(),
    callbackPath: '/api/giving/callback',
    encryptionKey: process.env.GIVING_CREDENTIALS_KEY,
  })
}
export async function givingUser(req?: Request) {
  if (req && !['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin)
      throw new GivingError('Forbidden request origin.', 403)
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new GivingError('Please sign in to continue.', 401)
  return user
}
export function givingFailure(error: unknown) {
  const status =
    error instanceof GivingError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 503
  const message =
    error instanceof GivingError
      ? error.message
      : error instanceof SyntaxError
        ? 'Invalid request body.'
        : 'Giving is temporarily unavailable. Please try again.'
  return Response.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'private, no-store' } }
  )
}
export function givingJson(value: unknown) {
  return Response.json(value, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
export function givingHistoryParams(req: Request): {
  churchId: string
  scope: 'mine' | 'church'
  filters: GivingHistoryFilters
} {
  const params = new URL(req.url).searchParams
  const scope = params.get('scope') || 'mine'
  if (scope !== 'mine' && scope !== 'church')
    throw new GivingError('Invalid history scope.')
  const filters: GivingHistoryFilters = {
    page: params.has('page') ? Number(params.get('page')) : undefined,
    pageSize: params.has('pageSize')
      ? Number(params.get('pageSize'))
      : undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    type: params.get('type') || undefined,
    status: params.get('status') || undefined,
  }
  return { churchId: params.get('churchId') ?? '', scope, filters }
}
