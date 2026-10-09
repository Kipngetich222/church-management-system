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

  const { data: memberships } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user.id)

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
