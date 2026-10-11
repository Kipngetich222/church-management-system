import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Look up whether an email already has an account and, when it does, whether
 * that account has a password.
 *
 * Accounts created with an OAuth provider such as Google have no password, so
 * password sign-in always fails for them with the generic "invalid login
 * credentials" error. Returning `hasPassword` lets the client tell those users
 * to continue with their provider instead of showing a misleading message.
 *
 * `hasPassword` is `null` when it cannot be determined, so callers fall back to
 * the raw auth error rather than blocking a legitimate sign-in.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email.includes('@')) {
    return NextResponse.json(
      { exists: false, hasPassword: null, providers: [] },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({
      exists: false,
      hasPassword: null,
      providers: [],
    })
  }

  const providers = await readProviders(admin, profile.id)

  return NextResponse.json({
    exists: true,
    hasPassword: providers ? providers.includes('email') : null,
    providers: providers ?? [],
  })
}

/** Read the linked sign-in providers from the auth record, or null if unknown. */
async function readProviders(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string[] | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data?.user) return null
    const providers = data.user.app_metadata?.providers
    if (!Array.isArray(providers) || providers.length === 0) return null
    return providers as string[]
  } catch {
    return null
  }
}
