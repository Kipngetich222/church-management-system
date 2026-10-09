import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dashboardPathForRole } from '@/lib/auth/redirect'
import { SelectChurchForm } from '@/components/auth/SelectChurchForm'

export default async function SelectChurchPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('church_memberships')
    .select('church_id, role, churches(id, name, slug, logo_url, plan)')
    .eq('user_id', user.id)

  if (!memberships?.length) redirect('/onboarding')

  // Users with a single church never need to be asked; send them straight on.
  if (memberships.length === 1) {
    redirect(dashboardPathForRole(memberships[0].role))
  }

  const options = memberships.map((m) => {
    const church = Array.isArray(m.churches) ? m.churches[0] : m.churches
    return {
      churchId: m.church_id,
      role: m.role,
      name: church?.name ?? 'Church',
      slug: church?.slug ?? '',
      logoUrl: church?.logo_url ?? null,
      plan: church?.plan ?? 'basic',
    }
  })

  return <SelectChurchForm options={options} />
}
