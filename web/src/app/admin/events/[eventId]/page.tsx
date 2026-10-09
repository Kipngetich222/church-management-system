import { getActiveChurch } from '@/lib/utils/church-scope'
import { getEventById } from '@/lib/services/events.service'
import { EventForm } from '@/components/events/EventForm'
import { EventQrPanel } from '@/components/events/EventQrPanel'
import { notFound } from 'next/navigation'

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const { churchId } = await getActiveChurch()
  const event = await getEventById(eventId)
  if (!event || event.church_id !== churchId) notFound()

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Edit event</h1>

      <EventForm churchId={churchId} existing={event as any} />

      <EventQrPanel eventId={eventId} qrCode={event.qr_code} />
    </div>
  )
}