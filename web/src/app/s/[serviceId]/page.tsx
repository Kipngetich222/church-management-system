import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Redirect hub for recurring-service QR codes and shared links (`/s/:id`).
 *
 * Members of the church are sent to the service page, where the programme lives
 * and check-in opens on the service day. Everyone else is sent to the public
 * view, which shows the programme for public services and a sign-in prompt for
 * members-only ones.
 */
export default async function ServiceRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { serviceId } = await params
  const { date } = await searchParams
  if (!UUID_RE.test(serviceId)) notFound()

  const query =
    date && DATE_RE.test(date) ? `?date=${encodeURIComponent(date)}` : ''

  const admin = createAdminClient()
  const { data: service } = await admin
    .from('recurring_services')
    .select('id, church_id, is_active')
    .eq('id', serviceId)
    .maybeSingle()

  if (!service || !service.is_active) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('church_id', service.church_id)
      .maybeSingle()

    if (membership) redirect(`/member/services/${service.id}${query}`)
  }

  redirect(`/services/${service.id}${query}`)
}
