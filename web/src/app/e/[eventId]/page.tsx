import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Redirect hub for event QR codes and shared short links (`/e/:id`).
 *
 * Members of the event's church are sent to the member event page (where they
 * can check in and manage their ticket); everyone else lands on the public
 * event page (where they can view details and register).
 */
export default async function EventRedirectPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  if (!UUID_RE.test(eventId)) notFound()

  const admin = createAdminClient()
  const { data: event } = await admin
    .from('events')
    .select('id, church_id, status')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.status === 'draft') notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: membership } = await supabase
      .from('church_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('church_id', event.church_id)
      .maybeSingle()

    if (membership) redirect(`/member/events/${event.id}`)
  }

  redirect(`/events/${event.id}`)
}
