import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default async function RegisterPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect(await resolvePostAuthPath(supabase, user.id))

  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
