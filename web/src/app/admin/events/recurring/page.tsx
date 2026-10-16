import Link from 'next/link'
import { getActiveChurch } from '@/lib/utils/church-scope'
import {
  listRecurringServices,
  listServiceExceptions,
  WEEKDAY_LABELS,
} from '@/lib/services/recurring-services.service'
import { nextOccurrence, occurrenceKey, todayKey } from '@/lib/utils/recurrence'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BackLink } from '@/components/shared/BackLink'
import { ChevronRight, Plus, Repeat } from 'lucide-react'

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function RecurringServicesPage() {
  const { churchId } = await getActiveChurch()

  const today = todayKey()
  const [services, exceptions] = await Promise.all([
    listRecurringServices(churchId),
    listServiceExceptions(churchId, today, addDays(today, 400)),
  ])

  const hidden = new Set(
    exceptions.map((e) => occurrenceKey(e.recurring_service_id, e.service_date))
  )

  return (
    <div className="space-y-6">
      <BackLink href="/admin/events" label="Events" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6" /> Recurring services
          </h1>
          <p className="text-sm text-muted-foreground">
            The services that always happen - Sunday, Saturday and the like. Set
            them up once and the calendar fills itself in.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/recurring/new">
            <Plus className="h-4 w-4 mr-2" /> New service
          </Link>
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No recurring services yet. Add your Sunday service to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <Link key={service.id} href={`/admin/events/recurring/${service.id}`}>
              <Card className="h-full transition hover:bg-muted/40">
                <CardContent className="pt-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{service.title}</span>
                      <Badge variant="secondary">
                        {WEEKDAY_LABELS[service.day_of_week]}s
                      </Badge>
                      {!service.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(service.times ?? [])
                        .map((t) => `${t.label} ${t.start}`)
                        .join(' - ') || 'No times set'}
                    </div>
                    {service.location_name && (
                      <div className="text-xs text-muted-foreground">
                        {service.location_name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Next: {nextOccurrence(service, today, hidden)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
