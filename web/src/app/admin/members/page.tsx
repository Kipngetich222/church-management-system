import { listMembers, listMemberBadges } from '@/lib/services/members.service'
import { getMemberStats } from '@/lib/types/members'
import { getPlanUsage } from '@/lib/services/plan.service'
import { MemberStatsCards } from '@/components/members/MemberStatsCards'
import { MembersTable } from '@/components/members/MembersTable'
import { MemberExportDialog } from '@/components/members/MemberExportDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AlertTriangle, Award, Plus, Upload } from 'lucide-react'
import { requirePermission } from '@/lib/auth/guard'

export default async function MembersPage() {
  const { church, churchId, role } = await requirePermission('members:read')

  const [members, usage] = await Promise.all([
    listMembers(churchId),
    getPlanUsage(churchId),
  ])
  const badges = await listMemberBadges(churchId, members)
  const stats = getMemberStats(members)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {usage.memberCount} member{usage.memberCount !== 1 ? 's' : ''}
            {usage.memberLimit
              ? ' of ' +
                usage.memberLimit +
                ' on the ' +
                usage.planName +
                ' plan'
              : ' — unlimited on the ' + usage.planName + ' plan'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<Link href="/admin/members/import" />}
          >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button
            variant="outline"
            render={<Link href="/admin/members/badges" />}
          >
            <Award className="mr-2 h-4 w-4" /> Badges
          </Button>
          <MemberExportDialog
            churchName={church?.name ?? 'Church'}
            members={members}
          />
          <Button render={<Link href="/admin/members/new" />}>
            <Plus className="mr-2 h-4 w-4" /> Add member
          </Button>
        </div>
      </div>

      {usage.atLimit && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              {church?.name ?? 'Your church'} has reached the{' '}
              {usage.memberLimit}
              -member limit on the {usage.planName} plan. Nobody new can join
              until you upgrade to the Growth plan.
            </span>
            <Button size="sm" render={<Link href="/admin/settings/plan" />}>
              Upgrade plan
            </Button>
          </CardContent>
        </Card>
      )}

      <MemberStatsCards stats={stats} />

      <MembersTable
        members={members}
        badges={badges}
        isSuperAdmin={role === 'super_admin'}
      />
    </div>
  )
}
