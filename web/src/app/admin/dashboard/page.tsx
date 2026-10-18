import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { getChurchSetup } from '@/lib/utils/church-setup'
import { getPlanUsage } from '@/lib/services/plan.service'
import { prayerRetentionCutoff } from '@/lib/services/prayer.service'
import { createClient } from '@/lib/supabase/server'
import {
  listUpcomingEvents,
  listPastEvents,
} from '@/lib/services/events.service'
import type { SetupStepKey } from '@/lib/constants/setup-steps'
import { ChurchLogo } from '@/components/shared/ChurchLogo'
import { DashboardEvents } from '@/components/events/DashboardEvents'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Coins,
  Crown,
  Heart,
  HeartHandshake,
  MapPin,
  Users,
  UsersRound,
} from 'lucide-react'

const STEP_ICONS: Record<
  SetupStepKey,
  React.ComponentType<{ className?: string }>
> = {
  profile: MapPin,
  leadership: Crown,
  members: Users,
  departments: Building2,
  events: CalendarDays,
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string
  value: string
  hint?: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  href?: string
}) {
  const body = (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default async function AdminDashboardPage() {
  const { church, churchId, role, user } = await getActiveChurch()
  const supabase = await createClient()

  const weekAgo = new Date(
    new Date().getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  const [
    setup,
    planUsage,
    upcoming,
    past,
    memberCount,
    baptizedCount,
    departmentCount,
    smallGroupCount,
    offerings,
  ] = await Promise.all([
    getChurchSetup(churchId, church),
    getPlanUsage(churchId),
    listUpcomingEvents(churchId, 5),
    listPastEvents(churchId, 5),
    supabase
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('church_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('is_baptized', true),
    supabase
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('small_groups')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId),
    supabase
      .from('offerings')
      .select('amount, given_at')
      .eq('church_id', churchId)
      .gte('given_at', weekAgo),
  ])

  const weekGiving = (offerings.data ?? []).reduce(
    (sum, o) => sum + Number(o.amount ?? 0),
    0
  )

  const prayerCutoff = prayerRetentionCutoff()
  const { data: dashboardMembership } = await supabase
    .from('church_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('church_id', churchId)
    .single()

  const [
    { count: prayerCount },
    { count: counsellingCount },
    { count: assignedPrayerCount },
    { count: assignedCounsellingCount },
  ] = await Promise.all([
    supabase
      .from('prayer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('type', 'prayer')
      .is('archived_at', null)
      .gte('created_at', prayerCutoff)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('prayer_requests')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('type', 'counseling')
      .in('status', ['open', 'in_progress']),
    dashboardMembership
      ? supabase
          .from('prayer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', dashboardMembership.id)
          .eq('type', 'prayer')
          .is('archived_at', null)
          .gte('created_at', prayerCutoff)
          .in('status', ['open', 'in_progress'])
      : Promise.resolve({ count: 0 }),
    dashboardMembership
      ? supabase
          .from('prayer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', dashboardMembership.id)
          .eq('type', 'counseling')
          .in('status', ['open', 'in_progress'])
      : Promise.resolve({ count: 0 }),
  ])
  const totalMembers = memberCount.count ?? 0
  const baptizedMembers = Math.min(baptizedCount.count ?? 0, totalMembers)
  const unbaptizedMembers = Math.max(totalMembers - baptizedMembers, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChurchLogo name={church?.name} logoUrl={church?.logo_url} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">Welcome to {church?.name}</h1>
          <p className="text-muted-foreground">Signed in as {role}</p>
        </div>
      </div>

      {!setup.isComplete && (
        <Card id="setup" className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle>Finish setting up your church</CardTitle>
            <p className="text-sm text-muted-foreground">
              {setup.completedCount} of {setup.total} steps done. This checklist
              stays here until your church is fully set up.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {setup.steps.map((step) => {
              const Icon = STEP_ICONS[step.key]
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className="flex items-start gap-3 rounded-lg border bg-background p-4 transition hover:bg-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="space-y-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          step.done ? 'text-muted-foreground line-through' : ''
                        }
                      >
                        {step.label}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {step.description}
                    </span>
                  </span>
                </Link>
              )
            })}
            <Button
              variant="link"
              className="justify-start px-0 md:col-span-2"
              nativeButton={false}
              render={<Link href="/admin/settings/church-profile" />}
            >
              Go to church profile
            </Button>
          </CardContent>
        </Card>
      )}

      {planUsage.atLimit && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>
                {church?.name ?? 'Your church'} has reached the{' '}
                {planUsage.memberLimit}-member limit on the {planUsage.planName}{' '}
                plan. Nobody new can join until you upgrade to the Growth plan.
              </span>
            </span>
            <Button render={<Link href="/admin/settings/plan" />}>
              Upgrade plan
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Members"
          value={String(totalMembers)}
          hint={
            <>
              <span className="text-green-600">
                {baptizedMembers.toLocaleString()} baptized
              </span>
              {' / '}
              <span>{unbaptizedMembers.toLocaleString()} not baptized</span>
            </>
          }
          icon={Users}
          href="/admin/members"
        />
        <StatCard
          label="Departments"
          value={String(departmentCount.count ?? 0)}
          hint="Manage departments and teams"
          icon={Building2}
          href="/admin/departments"
        />
        <StatCard
          label="Small Groups"
          value={String(smallGroupCount.count ?? 0)}
          hint="Manage groups and leaders"
          icon={UsersRound}
          href="/admin/small-groups"
        />
        <StatCard
          label="Prayer Requests"
          value={String(prayerCount ?? 0)}
          hint={`${assignedPrayerCount ?? 0} assigned to you`}
          icon={Heart}
          href="/admin/prayer-requests"
        />
        <StatCard
          label="Counselling"
          value={String(counsellingCount ?? 0)}
          hint={`${assignedCounsellingCount ?? 0} assigned to you`}
          icon={HeartHandshake}
          href="/admin/prayer-requests"
        />
        <StatCard
          label="This Week's Giving"
          value={`KES ${weekGiving.toLocaleString()}`}
          icon={Coins}
          href="/admin/finance/offerings"
        />
      </div>

      <DashboardEvents upcoming={upcoming} past={past} />
    </div>
  )
}
