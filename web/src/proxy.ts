import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Routes that require a signed-in user with at least one church membership.
  const isProtected =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/member') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/select-church')

  if (!isProtected) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Check membership
  const { data: memberships } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', user.id)

  if (!memberships?.length) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // /admin requires admin role
  if (pathname.startsWith('/admin')) {
    const isAdmin = memberships.some(
      (m) => m.role === 'super_admin' || m.role === 'dept_admin'
    )
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/member/home'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
