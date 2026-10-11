import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthPath, safeRedirect } from '@/lib/auth/redirect'
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
      let destination = requestedNext
      if (!destination) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
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
