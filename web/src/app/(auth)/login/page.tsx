import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage() {
  // Already signed in? Send them straight to the right dashboard (and let
  // multi-church users choose where to go).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect(await resolvePostAuthPath(supabase, user.id))

  return <LoginForm />
}
