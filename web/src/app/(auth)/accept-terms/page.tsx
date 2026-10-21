import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasAcceptedLegal } from '@/lib/auth/legal'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import { AcceptTermsForm } from '@/components/auth/AcceptTermsForm'

export const metadata: Metadata = {
  title: 'Accept terms - ChurchOnline',
}

export default async function AcceptTermsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error } = await supabase
    .from('users')
    .select('terms_accepted_at, privacy_accepted_at, legal_version')
    .eq('id', user.id)
    .maybeSingle()

  if (!error && hasAcceptedLegal(profile)) {
    redirect(await resolvePostAuthPath(supabase, user.id))
  }

  return <AcceptTermsForm />
}
