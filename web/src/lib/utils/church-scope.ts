import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACTIVE_CHURCH_COOKIE } from '@/lib/constants/church'
import { isAdminRole } from '@/lib/auth/redirect'

/**
 * Resolve the active church for the current user.
 * Priority: explicit churchId param → user's only church → first membership.
 * Throws if user has no memberships.
 */
export async function getActiveChurch(explicitChurchId?: string) {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const storedChurchId = cookieStore.get(ACTIVE_CHURCH_COOKIE)?.value

  const { data: memberships, error } = await supabase
    .from('church_memberships')
    .select('church_id, role, churches(*)')
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to fetch church memberships:', error)
    throw new Error('Failed to load church memberships')
  }

  if (!memberships?.length) {
    redirect('/onboarding')
  }

  const active =
    (explicitChurchId
      ? memberships.find((m) => m.church_id === explicitChurchId)
      : undefined) ??
    (storedChurchId
      ? memberships.find((m) => m.church_id === storedChurchId)
      : undefined) ??
    memberships[0]

  if (!active) {
    redirect('/onboarding')
  }

  // Supabase may infer the nested relationship as an array.
  // A membership belongs to one church, so take the first church.
  const church = Array.isArray(active.churches)
    ? active.churches[0]
    : active.churches

  if (!church) {
    redirect('/onboarding')
  }

  return {
    user,
    churchId: active.church_id,
    role: active.role,
    church,
    memberships,
  }
}

/**
 * Assert the current user is an admin of the given church.
 * Redirects to /member/home if not.
 */
export async function requireChurchAdmin(churchId: string) {
  const ctx = await getActiveChurch(churchId)

  if (!isAdminRole(ctx.role)) {
    redirect('/member/home')
  }

  return ctx
}
