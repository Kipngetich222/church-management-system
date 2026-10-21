import { createClient } from '@/lib/supabase/server'
import { recordLegalConsent } from '@/lib/auth/legal'
import { resolvePostAuthPath, safeRedirect } from '@/lib/auth/redirect'
import { LEGAL_VERSION } from '@/lib/legal'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedNext = safeRedirect(searchParams.get('next'))
  const isRecovery = requestedNext === '/reset-password'
  const providerError =
    searchParams.get('error_description') ?? searchParams.get('error')

  if (code && !providerError) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const metadata = user?.user_metadata
      const acceptedVersion =
        searchParams.get('legal') ??
        (typeof metadata?.legal_version === 'string'
          ? metadata.legal_version
          : null)
      const acceptedAt =
        typeof metadata?.terms_accepted_at === 'string'
          ? metadata.terms_accepted_at
          : undefined

      if (user && acceptedVersion === LEGAL_VERSION) {
        const consentError = await recordLegalConsent(
          supabase,
          user.id,
          acceptedAt
        )
        if (consentError) {
          console.error('Failed to record legal consent:', consentError)
        }
      }

      let destination = requestedNext
      if (!destination) {
        destination = user
          ? await resolvePostAuthPath(supabase, user.id)
          : '/onboarding'
      }
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // The link was invalid or has expired. Send password-reset failures back to
  // the request form (where the user can ask for a fresh link) and everything
  // else back to sign-in.
  const failurePath = isRecovery
    ? '/forgot-password?error=link_expired'
    : '/login?error=auth_failed'
  return NextResponse.redirect(`${origin}${failurePath}`)
}
