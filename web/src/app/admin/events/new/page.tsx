import { getActiveChurch } from '@/lib/utils/church-scope'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '@/components/events/EventForm'
import { BackLink } from '@/components/shared/BackLink'

export default async function NewEventPage() {
  const { churchId } = await getActiveChurch()
  const supabase = await createClient()

  const [{ data: departments }, { data: groups }] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name'),
    supabase
      .from('small_groups')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name'),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href="/admin/events" label="Events" />

      <h1 className="text-2xl font-bold">Create event</h1>
      <EventForm
        churchId={churchId}
        departments={departments ?? []}
        groups={groups ?? []}
      />
    </div>
  )
}
