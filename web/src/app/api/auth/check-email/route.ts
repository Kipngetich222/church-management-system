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

  // Block sign-up while an account deletion for this email is still being
  // processed (from request until the account is fully removed).
  const { data: pendingDeletion } = await admin
    .from('member_deletion_requests')
    .select('id')
    .ilike('user_email', email)
    .eq('status', 'pending')
    .maybeSingle()
  const deletionPending = Boolean(pendingDeletion)

  if (!profile) {
    return NextResponse.json({
      exists: false,
      hasPassword: null,
      providers: [],
      deletionPending,
    })
  }

  const providers = await readProviders(admin, profile.id)

  return NextResponse.json({
    exists: true,
    hasPassword: providers ? providers.includes('email') : null,
    providers: providers ?? [],
    deletionPending,
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
