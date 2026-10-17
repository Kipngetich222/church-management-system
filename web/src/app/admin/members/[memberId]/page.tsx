import { createClient } from '@/lib/supabase/server'
import { getMember, listMemberBadges } from '@/lib/services/members.service'
import { requirePermission } from '@/lib/auth/guard'
import { MemberForm } from '@/components/members/MemberForm'
import { BadgeCard } from '@/components/members/BadgeCard'
import { findBadgeDefinition } from '@/components/members/BadgeChip'
import { DeleteMemberButton } from '@/components/members/DeleteMemberButton'
import { PastoralNotesPanel } from '@/components/members/PastoralNotesPanel'
import { BackLink } from '@/components/shared/BackLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Award, Smartphone } from 'lucide-react'
import { memberEmail, memberName, memberPhone } from '@/lib/types/members'

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = await params
  const { churchId, role } = await requirePermission('members:read')

  const [member, badges] = await Promise.all([
    getMember(churchId, memberId),
    listMemberBadges(churchId),
  ])

  if (!member) notFound()

  const canSeePastoral = role === 'super_admin'
  const supabase = await createClient()
  const { data: pastoralNotes } = canSeePastoral
    ? await supabase
        .from('pastoral_notes')
        .select('*')
        .eq('membership_id', memberId)
        .order('created_at', { ascending: false })
    : { data: [] }

  const name = memberName(member)
  const assignedBadgeNames = [...member.badges]
  if (
    member.is_baptized &&
    !assignedBadgeNames.some((badge) => badge.toLowerCase() === 'baptized')
  ) {
    assignedBadgeNames.push('baptized')
  }
  const assignedBadges = assignedBadgeNames.map((badge) =>
    findBadgeDefinition(badge, badges)
  )

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/admin/members" label="Members" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Edit member</h1>
          <p className="text-sm text-muted-foreground">
            {name}
            {member.user_id ? ' · has an app account' : ' · manual member'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/members/badges" />}
          >
            <Award className="mr-2 h-4 w-4" /> Manage badges
          </Button>
          {role === 'super_admin' ? (
            <DeleteMemberButton
              memberId={member.id}
              memberName={name}
              redirectTo="/admin/members"
              label="Delete member"
            />
          ) : null}
        </div>
      </div>

      {!member.user_id ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            This member has no account. Use their phone number for SMS
            communication. They will not appear in app sign-in or member-only
            screens.
          </p>
        </div>
      ) : null}

      {assignedBadges.length ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Assigned badges</h2>
            <Badge variant="secondary">{assignedBadges.length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {assignedBadges.map((badge) => (
              <BadgeCard key={badge.name} badge={badge} compact />
            ))}
          </div>
        </div>
      ) : null}

      <MemberForm
        churchId={churchId}
        isSuperAdmin={role === 'super_admin'}
        canAssignBadges={role === 'super_admin' || role === 'dept_admin'}
        badges={badges}
        existing={{
          id: member.id,
          user_id: member.user_id,
          full_name: name,
          email: memberEmail(member),
          phone: memberPhone(member),
          badges: member.badges,
          is_baptized: member.is_baptized,
          date_of_birth: member.date_of_birth,
          gender: member.gender,
          category: member.category,
          address: member.address,
          is_manual: member.is_manual,
        }}
      />

      {canSeePastoral ? (
        <PastoralNotesPanel
          churchId={churchId}
          membershipId={memberId}
          notes={pastoralNotes ?? []}
        />
      ) : null}
    </div>
  )
}
