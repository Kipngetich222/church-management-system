import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/auth/OnboardingWizard'
import { resolvePostAuthPath } from '@/lib/auth/redirect'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>
}) {
  const { church: initialChurch } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships, error: membershipError } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user.id)

  // If this fails we must not silently show the wizard - otherwise a user who
  // already belongs to a church gets stuck here forever. Surface the problem.
  if (membershipError) {
    console.error('Failed to load memberships on onboarding:', membershipError)
    throw new Error(
      'We could not load your church memberships. Please refresh and try again.'
    )
  }

  // Already belongs to a church — send to the right dashboard.
  if (memberships?.length) {
    redirect(await resolvePostAuthPath(supabase, user.id))
  }

  const publicClient = createPublicClient()
  const { data: churches } = await publicClient
    .from('churches')
    .select('id, name, slug, description, logo_url')
    .order('name')

  return (
    <OnboardingWizard churches={churches ?? []} initialChurch={initialChurch} />
  )
}
