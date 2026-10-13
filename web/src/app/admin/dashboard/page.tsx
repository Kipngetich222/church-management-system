import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { getChurchSetup } from '@/lib/utils/church-setup'
import type { SetupStepKey } from '@/lib/constants/setup-steps'
import { ChurchLogo } from '@/components/shared/ChurchLogo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Coins,
  MapPin,
  Users,
} from 'lucide-react'

const STEP_ICONS: Record<
  SetupStepKey,
  React.ComponentType<{ className?: string }>
> = {
  profile: MapPin,
  members: Users,
  departments: Building2,
  events: CalendarDays,
}

export default async function AdminDashboardPage() {
  const { church, churchId, role } = await getActiveChurch()
  const setup = await getChurchSetup(churchId, church)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChurchLogo
          name={church?.name}
          logoUrl={church?.logo_url}
          size="lg"
        />
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </span>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>—</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>—</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Coins className="h-4 w-4" />
            </span>
            <CardTitle>This Week&apos;s Giving</CardTitle>
          </CardHeader>
          <CardContent>—</CardContent>
        </Card>
      </div>
    </div>
  )
}
