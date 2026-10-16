import { notFound } from 'next/navigation'
import { getActiveChurch } from '@/lib/utils/church-scope'
import {
  getRecurringService,
  getProgramme,
  getProgrammeFileUrl,
  listServiceAttendance,
  listHiddenDates,
  WEEKDAY_LABELS,
} from '@/lib/services/recurring-services.service'
import { nextOccurrence, todayKey } from '@/lib/utils/recurrence'
import { RecurringServiceForm } from '@/components/events/RecurringServiceForm'
import { ServiceQrPanel } from '@/components/events/ServiceQrPanel'
import { ServiceProgrammePanel } from '@/components/events/ServiceProgrammePanel'
import { ServiceRegisterDatePicker } from '@/components/events/ServiceRegisterDatePicker'
import { ServiceOccurrenceToggle } from '@/components/events/ServiceOccurrenceToggle'
import { RecurringServiceDangerZone } from '@/components/events/RecurringServiceDangerZone'
import { ExportButton } from '@/components/shared/ExportButton'
import { BackLink } from '@/components/shared/BackLink'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function isDateKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function RecurringServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id } = await params
  const { date } = await searchParams
  const { churchId } = await getActiveChurch()
  const service = await getRecurringService(id)
  if (!service || service.church_id !== churchId) notFound()

  // Which occurrence to look at: the requested date, else today when today is a
  // service day, else the next one coming up.
  const today = todayKey()
  const todayIsServiceDay =
    new Date(`${today}T00:00:00`).getDay() === service.day_of_week
  const occurrenceDate = isDateKey(date)
    ? date
    : todayIsServiceDay
      ? today
      : nextOccurrence(service, today)

  const [programme, attendance, hiddenDates] = await Promise.all([
    getProgramme(service.id, occurrenceDate),
    listServiceAttendance(service.id, occurrenceDate),
    listHiddenDates(service.id),
  ])

  const programmeUrl = await getProgrammeFileUrl(programme)

  const occurrenceHidden = hiddenDates.includes(occurrenceDate)

  const csvRows = [
    ['Name', 'Email', 'Checked in at', 'Method'],
    ...attendance.map((a) => [
      a.church_memberships?.users?.full_name ?? '',
      a.church_memberships?.users?.email ?? '',
      a.scanned_at ? new Date(a.scanned_at).toLocaleString() : '',
      a.method ?? 'qr',
    ]),
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <BackLink href="/admin/events/recurring" label="Recurring services" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{service.title}</h1>
          <p className="text-sm text-muted-foreground">
            Every {WEEKDAY_LABELS[service.day_of_week]}
            {' - '}
            {(service.times ?? [])
              .map((t) => `${t.label} ${t.start}`)
              .join(' - ') || 'No times set'}
          </p>
        </div>
        <ServiceOccurrenceToggle
          churchId={churchId}
          serviceId={service.id}
          date={occurrenceDate}
          hidden={occurrenceHidden}
        />
      </div>

      {occurrenceHidden && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          {occurrenceDate} is hidden. The calendars skip this day, but the service
          and its history are kept. Restore it above to show it again.
        </div>
      )}

      <ServiceQrPanel serviceId={service.id} qrCode={service.qr_code} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Attendance register</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <ServiceRegisterDatePicker
              basePath={`/admin/events/recurring/${service.id}`}
              value={occurrenceDate}
            />
            <ExportButton
              filename={`${service.title}-attendance-${occurrenceDate}.csv`}
              title={`${service.title} - Register (${occurrenceDate})`}
              rows={csvRows}
              label="Export register"
            />
          </div>
        </div>

        <Card>
          <CardContent className="py-0">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Checked in at</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.church_memberships?.users?.full_name ?? 'Unknown member'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.church_memberships?.users?.email ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.scanned_at ? new Date(a.scanned_at).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {a.method ?? 'qr'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {attendance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        Nobody has checked in for {occurrenceDate} yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {attendance.length} checked in on {occurrenceDate}.
        </p>
      </div>

      <ServiceProgrammePanel
        churchId={churchId}
        serviceId={service.id}
        date={occurrenceDate}
        existing={programme}
        existingUrl={programmeUrl}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Service settings</h2>
        <RecurringServiceForm churchId={churchId} existing={service} />
      </div>

      <RecurringServiceDangerZone serviceId={service.id} title={service.title} />
    </div>
  )
}
