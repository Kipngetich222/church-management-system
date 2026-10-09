import { notFound, redirect } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase/public'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Short event links (`/abcdef...`) redirect to the canonical event page.
 * Anything that is not a valid event id renders a 404.
 */
export default async function ShortEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params

  if (UUID_RE.test(eventId)) {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle()

    if (data) redirect(`/events/${data.id}`)
  }

  notFound()
}
