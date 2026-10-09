import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Building2, CalendarDays, MapPin, Users } from 'lucide-react'

const SETUP_STEPS = [
  {
    label: 'Complete your church profile',
    description: 'Add contact details, a logo, and set your location on the map.',
    href: '/admin/settings/church-profile',
    icon: MapPin,
  },
  {
    label: 'Add your members',
    description: 'Import or invite the people in your congregation.',
    href: '/admin/members',
    icon: Users,
  },
  {
    label: 'Create departments',
    description: 'Organise ministries such as worship, youth, and ushering.',
    href: '/admin/departments',
    icon: Building2,
  },
  {
    label: 'Plan an event',
    description: 'Schedule a service or activity for your church.',
    href: '/admin/events',
    icon: CalendarDays,
  },
]

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  const { church, role } = await getActiveChurch()
  const { setup } = await searchParams

  const needsSetup =
    setup === '1' ||
    !church.address ||
    church.latitude == null ||
    church.longitude == null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome to {church?.name}</h1>
        <p className="text-muted-foreground">Signed in as {role}</p>
      </div>

      {needsSetup && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle>Finish setting up your church</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {SETUP_STEPS.map((step) => {
              const Icon = step.icon
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
                    <span className="block text-sm font-medium">
                      {step.label}
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
              render={<Link href="/admin/dashboard" />}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>This Week&apos;s Giving</CardTitle>
          </CardHeader>
          <CardContent>—</CardContent>
        </Card>
      </div>
    </div>
  )
}
