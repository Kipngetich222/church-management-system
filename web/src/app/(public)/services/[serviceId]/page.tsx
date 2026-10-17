import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { createAdminClient } from '@/lib/supabase/admin'
import { appBaseUrl } from '@/lib/utils/app-url'
import {
  isServiceDate,
  nextOccurrence,
  occurrenceKey,
  todayKey,
} from '@/lib/utils/recurrence'
import { programmeStoragePath } from '@/lib/services/recurring-services.service'
import {
  WEEKDAY_LABELS,
  type RecurringServiceRow,
  type ServiceProgrammeRow,
  type ServiceTime,
} from '@/lib/constants/services'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShareButton } from '@/components/shared/ShareButton'
import {
  CalendarDays,
  Clock,
  FileText,
  Lock,
  MapPin,
} from 'lucide-react'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type SharedService = RecurringServiceRow & {
  churches: { name: string | null; username: string | null } | null
}

/** Load an active service regardless of visibility so we can choose the state. */
async function loadService(serviceId: string): Promise<SharedService | null> {
  if (!UUID_RE.test(serviceId)) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('recurring_services')
    .select('*, churches(name, username)')
    .eq('id', serviceId)
    .eq('is_active', true)
    .maybeSingle()
  return (data as unknown as SharedService) ?? null
}

function prettyDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimes(times: ServiceTime[]): string {
  if (!Array.isArray(times) || times.length === 0) return 'Time to be announced'
  return times
    .map((t) => `${t.label ? `${t.label}: ` : ''}${t.start}${t.end ? ` - ${t.end}` : ''}`)
    .join('  |  ')
}

async function resolveOccurrence(
  service: SharedService,
  requestedDate: string | undefined
): Promise<string> {
  const admin = createAdminClient()
  const today = todayKey()
  const todayIsServiceDay =
    new Date(`${today}T00:00:00`).getDay() === service.day_of_week

  // The exceptions table is optional (migration 0029); treat a missing table as
  // "nothing hidden" rather than failing the share page.
  const { data: exceptions } = await admin
    .from('service_exceptions')
    .select('service_date')
    .eq('recurring_service_id', service.id)
  const hidden = new Set(
    (exceptions ?? []).map((e) => occurrenceKey(service.id, e.service_date))
  )

  const requested =
    requestedDate &&
    DATE_RE.test(requestedDate) &&
    isServiceDate(service, requestedDate)
      ? requestedDate
      : null

  if (requested && !hidden.has(occurrenceKey(service.id, requested))) {
    return requested
  }
  if (todayIsServiceDay && !hidden.has(occurrenceKey(service.id, today))) {
    return today
  }
  return nextOccurrence(service, today, hidden)
}

async function programmeFor(
  serviceId: string,
  serviceDate: string
): Promise<{ programme: ServiceProgrammeRow | null; url: string | null }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('service_programmes')
    .select('*')
    .eq('recurring_service_id', serviceId)
    .eq('service_date', serviceDate)
    .maybeSingle()

  const programme = (data as ServiceProgrammeRow | null) ?? null
  const path = programmeStoragePath(programme)
  if (!path) return { programme, url: null }

  // The bucket is private. The service-role client may sign a URL so visitors
  // holding a share link for a *public* service can download the programme.
  const { data: signed } = await admin.storage
    .from('service-programmes')
    .createSignedUrl(path, 60 * 60 * 24)
  return { programme, url: signed?.signedUrl ?? null }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serviceId: string }>
}): Promise<Metadata> {
  const { serviceId } = await params
  const service = await loadService(serviceId)

  if (!service || service.visibility !== 'public') {
    return { title: 'Church service' }
  }

  const churchName = service.churches?.name ?? 'Church service'
  const description =
    service.description ?? `Programme and details for ${service.title}.`
  const url = `${appBaseUrl()}/services/${service.id}`

  return {
    title: `${service.title} - ${churchName}`,
    description,
    openGraph: {
      title: `${service.title} - ${churchName}`,
      description,
      url,
      type: 'website',
    },
    twitter: { card: 'summary', title: service.title, description },
  }
}

export default async function PublicServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { serviceId } = await params
  const { date } = await searchParams
  const service = await loadService(serviceId)
  if (!service) notFound()

  const churchName = service.churches?.name ?? 'this church'

  // Members-only services are never exposed to visitors through a share link.
  if (service.visibility !== 'public') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Members only
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This service is for members of {churchName}. Sign in to view the
              programme and details.
            </p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const occurrenceDate = await resolveOccurrence(service, date)
  const { programme, url: programmeUrl } = await programmeFor(
    service.id,
    occurrenceDate
  )
  const shareUrl = `${appBaseUrl()}/s/${service.id}?date=${occurrenceDate}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Every {WEEKDAY_LABELS[service.day_of_week]}
            </Badge>
            {service.churches?.name && (
              <Badge variant="outline">{service.churches.name}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-2xl">{service.title}</CardTitle>
            <ShareButton
              url={shareUrl}
              title={service.title}
              text={`${service.title} - ${churchName}`}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {prettyDate(occurrenceDate)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {formatTimes(service.times)}
            </span>
            {service.location_name && (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {service.location_name}
              </span>
            )}
          </div>

          <div className="space-y-3 rounded-lg border bg-primary/5 p-4">
            <div className="flex items-center gap-2 font-medium">
              <FileText className="h-5 w-5" /> Programme
            </div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {prettyDate(occurrenceDate)}
            </p>
            {programmeUrl ? (
              <>
                {programme?.title && (
                  <p className="text-sm text-muted-foreground">
                    {programme.title}
                  </p>
                )}
                <Button asChild>
                  <a href={programmeUrl} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4 mr-2" /> Download programme
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No programme has been published for this service yet. Please
                check back closer to the service.
              </p>
            )}
          </div>

          {service.description && (
            <p className="whitespace-pre-wrap text-sm">{service.description}</p>
          )}

          {service.procedure && (
            <div className="space-y-1">
              <h2 className="font-medium">Order of service</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {service.procedure}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Shared from {churchName} on ChurchOnline.
      </p>
    </div>
  )
}
