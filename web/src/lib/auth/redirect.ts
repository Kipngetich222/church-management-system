import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const ADMIN_ROLES = ['super_admin', 'dept_admin'] as const

export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role)
}

/** The dashboard a membership role should open by default. */
export function dashboardPathForRole(role: string): string {
  return isAdminRole(role) ? '/admin/dashboard' : '/member/home'
}

/**
 * Work out where a freshly authenticated user should land:
 * - no memberships       -> onboarding (choose/create a church)
 * - exactly one church   -> that church's dashboard (admin or member)
 * - several churches     -> church chooser so the user picks where to go
 */
export async function resolvePostAuthPath(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const { data: memberships, error } = await supabase
    .from('church_memberships')
    .select('role')
    .eq('user_id', userId)

  if (error || !memberships?.length) return '/onboarding'

  // Only users who belong to more than one church need to be asked.
  if (memberships.length > 1) return '/select-church'

  return dashboardPathForRole(memberships[0].role)
}

/** Only allow same-origin, absolute path redirects. */
export function safeRedirect(path: string | null | undefined): string | null {
  if (!path) return null
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}
