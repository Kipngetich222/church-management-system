import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePostAuthPath } from '@/lib/auth/redirect'
import { isProfileComplete, type MemberCategory } from '@/lib/auth/profile'
import { ProfileCompletionForm } from '@/components/auth/ProfileCompletionForm'

export default async function CompleteProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('phone, gender, category, date_of_birth')
    .eq('id', user.id)
    .maybeSingle()

  // Already done - move them on so this page never traps anyone.
  if (isProfileComplete(profile)) {
    redirect(await resolvePostAuthPath(supabase, user.id))
  }

  return (
    <ProfileCompletionForm
      initial={{
        phone: profile?.phone ?? '',
        gender: profile?.gender ?? '',
        category: (profile?.category as MemberCategory | null) ?? '',
        date_of_birth: profile?.date_of_birth ?? '',
      }}
    />
  )
}