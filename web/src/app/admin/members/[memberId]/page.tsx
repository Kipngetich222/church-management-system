import { createClient } from '@/lib/supabase/server'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { MemberForm } from '@/components/members/MemberForm'
import { notFound } from 'next/navigation'
import { PastoralNotesPanel } from '@/components/members/PastoralNotesPanel'
import { BackLink } from '@/components/shared/BackLink'

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = await params
  const { churchId, role } = await getActiveChurch()
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('church_memberships')
    .select(
      `
      id, user_id, badges, is_baptized, address,
      users!inner(full_name, email, phone, date_of_birth, gender, category)
    `
    )
    .eq('id', memberId)
    .eq('church_id', churchId)
    .single()

  if (!membership) notFound()

  const canSeePastoral = role === 'super_admin'
const { data: pastoralNotes } = canSeePastoral
  ? await supabase.from('pastoral_notes').select('*').eq('membership_id', memberId).order('created_at', { ascending: false })
  : { data: [] }

  const u = membership.users

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/admin/members" label="Members" />

      <h1 className="text-2xl font-bold">Edit member</h1>
      <MemberForm
        churchId={churchId}
        isSuperAdmin={role === 'super_admin'}
        existing={{
          id: membership.id,
          user_id: membership.user_id,
          full_name: u.full_name ?? '',
          email: u.email,
          phone: u.phone ?? '',
          badges: membership.badges ?? [],
          is_baptized: membership.is_baptized ?? false,
          date_of_birth: u.date_of_birth,
          gender: u.gender,
          category: u.category,
          address: membership.address,
        }}
      />

      {canSeePastoral && (
  <PastoralNotesPanel
    churchId={churchId}
    membershipId={memberId}
    notes={pastoralNotes ?? []}
  />
)}
    </div>
  )
}