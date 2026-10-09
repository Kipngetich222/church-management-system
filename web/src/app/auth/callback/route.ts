import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthPath, safeRedirect } from '@/lib/auth/redirect'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedNext = safeRedirect(searchParams.get('next'))

  if (code) {
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

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
