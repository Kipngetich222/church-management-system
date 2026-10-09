import { getActiveChurch } from '@/lib/utils/church-scope'
import { EventForm } from '@/components/events/EventForm'

export default async function NewEventPage() {
  const { churchId } = await getActiveChurch()
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Create event</h1>
      <EventForm churchId={churchId} />
    </div>
  )
}