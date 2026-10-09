import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthPath } from '@/lib/auth/redirect'

/**
 * Single entry point for "Dashboard" buttons. Sends the signed-in user to
 * their church dashboard, the church chooser (multiple memberships), or
 * onboarding (no memberships).
 */
export default async function DashboardRedirectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  redirect(await resolvePostAuthPath(supabase, user.id))
}
