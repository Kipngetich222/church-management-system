import { getActiveChurch } from '@/lib/utils/church-scope'
import { RecurringServiceForm } from '@/components/events/RecurringServiceForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewRecurringServicePage() {
  const { churchId } = await getActiveChurch()

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/admin/events/recurring" label="Recurring services" />

      <div>
        <h1 className="text-2xl font-bold">New recurring service</h1>
        <p className="text-sm text-muted-foreground">
          Describe the service once. Every matching day shows up on the calendar
          automatically.
        </p>
      </div>

      <RecurringServiceForm churchId={churchId} />
    </div>
  )
}
